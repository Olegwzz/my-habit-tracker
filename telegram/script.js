// Проверка, запущено ли в Telegram
const isTelegram = window.Telegram && window.Telegram.WebApp;

// Инициализация Telegram Web App
if (isTelegram) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    
    // Настройка цветовой схемы Telegram
    document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color || '#ffffff');
    document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color || '#000000');
    document.documentElement.style.setProperty('--tg-theme-hint-color', tg.themeParams.hint_color || '#999999');
    document.documentElement.style.setProperty('--tg-theme-link-color', tg.themeParams.link_color || '#667eea');
    document.documentElement.style.setProperty('--tg-theme-button-color', tg.themeParams.button_color || '#667eea');
    document.documentElement.style.setProperty('--tg-theme-button-text-color', tg.themeParams.button_text_color || '#ffffff');
    document.documentElement.style.setProperty('--tg-theme-secondary-bg-color', tg.themeParams.secondary_bg_color || '#f5f5f5');
}

// Управление данными с поддержкой Telegram Cloud Storage
class HabitTracker {
    constructor() {
        this.currentDate = new Date();
        this.habits = [];
        this.data = {}; // {habitId: {day: status}}
        this.isTelegram = isTelegram;
        this.tg = isTelegram ? window.Telegram.WebApp : null;
        this.init();
    }

    init() {
        this.loadData().then(() => {
            this.renderTable();
            this.setupEventListeners();
            this.updateMonthDisplay();
        });
    }

    // Загрузка данных (из Telegram Cloud Storage или localStorage)
    async loadData() {
        if (this.isTelegram && this.tg) {
            try {
                // Пытаемся загрузить из Telegram Cloud Storage
                const cloudData = await this.tg.CloudStorage.getItem('habitTrackerData');
                if (cloudData) {
                    const parsed = JSON.parse(cloudData);
                    this.habits = parsed.habits || [];
                    this.data = parsed.data || {};
                    this.currentDate = parsed.currentDate ? new Date(parsed.currentDate) : new Date();
                    return;
                }
            } catch (e) {
                console.log('Cloud Storage недоступен, используем localStorage');
            }
        }
        
        // Fallback на localStorage
        const saved = localStorage.getItem('habitTrackerData');
        if (saved) {
            const parsed = JSON.parse(saved);
            this.habits = parsed.habits || [];
            this.data = parsed.data || {};
            this.currentDate = parsed.currentDate ? new Date(parsed.currentDate) : new Date();
        } else {
            // Инициализация с 10 привычками по умолчанию
            this.habits = Array.from({ length: 10 }, (_, i) => ({
                id: `habit-${i + 1}`,
                name: `Привычка ${i + 1}`
            }));
        }
    }

    // Сохранение данных (в Telegram Cloud Storage и localStorage)
    async saveData() {
        const toSave = {
            habits: this.habits,
            data: this.data,
            currentDate: this.currentDate.toISOString()
        };
        const dataString = JSON.stringify(toSave);
        
        // Сохраняем в localStorage (fallback)
        localStorage.setItem('habitTrackerData', dataString);
        
        // Сохраняем в Telegram Cloud Storage если доступно
        if (this.isTelegram && this.tg && this.tg.CloudStorage) {
            try {
                await this.tg.CloudStorage.setItem('habitTrackerData', dataString);
            } catch (e) {
                console.log('Ошибка сохранения в Cloud Storage:', e);
            }
        }
        
        // Вибрация при сохранении (если в Telegram)
        if (this.isTelegram && this.tg) {
            this.tg.HapticFeedback.impactOccurred('light');
        }
    }

    // Получение количества дней в текущем месяце
    getDaysInMonth() {
        return new Date(
            this.currentDate.getFullYear(),
            this.currentDate.getMonth() + 1,
            0
        ).getDate();
    }

    // Получение ключа для месяца (год-месяц)
    getMonthKey() {
        return `${this.currentDate.getFullYear()}-${this.currentDate.getMonth()}`;
    }

    // Получение статуса привычки на день
    getHabitStatus(habitId, day) {
        const monthKey = this.getMonthKey();
        const habitData = this.data[habitId] || {};
        const monthData = habitData[monthKey] || {};
        return monthData[day] || 'neutral'; // 'plus', 'minus', 'neutral'
    }

    // Установка статуса привычки на день
    async setHabitStatus(habitId, day, status) {
        const monthKey = this.getMonthKey();
        if (!this.data[habitId]) {
            this.data[habitId] = {};
        }
        if (!this.data[habitId][monthKey]) {
            this.data[habitId][monthKey] = {};
        }
        this.data[habitId][monthKey][day] = status;
        await this.saveData();
        this.updateStats();
    }

    // Переключение статуса (neutral -> plus -> minus -> neutral)
    async toggleHabitStatus(habitId, day) {
        const current = this.getHabitStatus(habitId, day);
        let next;
        if (current === 'neutral') {
            next = 'plus';
        } else if (current === 'plus') {
            next = 'minus';
        } else {
            next = 'neutral';
        }
        await this.setHabitStatus(habitId, day, next);
        this.renderTable();
    }

    // Расчет процента выполнения для привычки
    calculateHabitPercent(habitId) {
        const daysInMonth = this.getDaysInMonth();
        let completed = 0;
        for (let day = 1; day <= daysInMonth; day++) {
            if (this.getHabitStatus(habitId, day) === 'plus') {
                completed++;
            }
        }
        return Math.round((completed / daysInMonth) * 100);
    }

    // Расчет общей эффективности
    calculateTotalPercent() {
        if (this.habits.length === 0) return 0;
        const sum = this.habits.reduce((acc, habit) => {
            return acc + this.calculateHabitPercent(habit.id);
        }, 0);
        return Math.round(sum / this.habits.length);
    }

    // Обновление статистики
    updateStats() {
        this.habits.forEach(habit => {
            const percent = this.calculateHabitPercent(habit.id);
            const cell = document.querySelector(`[data-habit-id="${habit.id}"] .percent-cell`);
            if (cell) {
                cell.textContent = `${percent}%`;
                cell.className = 'percent-cell';
                if (percent >= 70) {
                    cell.classList.add('high');
                } else if (percent >= 40) {
                    cell.classList.add('medium');
                } else {
                    cell.classList.add('low');
                }
            }
        });

        const totalPercent = this.calculateTotalPercent();
        const totalCell = document.getElementById('totalPercent');
        if (totalCell) {
            totalCell.textContent = `${totalPercent}%`;
        }
    }

    // Рендеринг таблицы
    renderTable() {
        const daysInMonth = this.getDaysInMonth();
        const tbody = document.getElementById('habitsBody');
        const daysRow = document.querySelector('.days-row');

        // Очистка
        tbody.innerHTML = '';
        daysRow.innerHTML = '<th></th>';

        // Добавление заголовков дней
        for (let day = 1; day <= daysInMonth; day++) {
            const th = document.createElement('th');
            th.textContent = day;
            daysRow.appendChild(th);
        }
        daysRow.innerHTML += '<th></th>';

        // Добавление строк привычек
        this.habits.forEach(habit => {
            const row = document.createElement('tr');
            row.setAttribute('data-habit-id', habit.id);

            // Название привычки
            const nameCell = document.createElement('td');
            nameCell.className = 'habit-name';
            nameCell.innerHTML = `<span class="habit-name-text">${habit.name}</span>`;
            nameCell.addEventListener('click', () => this.editHabitName(habit.id, nameCell));
            row.appendChild(nameCell);

            // Ячейки дней
            for (let day = 1; day <= daysInMonth; day++) {
                const dayCell = document.createElement('td');
                dayCell.className = 'day-cell';
                const status = this.getHabitStatus(habit.id, day);
                const btn = document.createElement('button');
                btn.className = `day-btn ${status}`;
                
                if (status === 'plus') {
                    btn.textContent = '+';
                } else if (status === 'minus') {
                    btn.textContent = '−';
                } else {
                    btn.textContent = '○';
                }

                btn.addEventListener('click', () => {
                    this.toggleHabitStatus(habit.id, day);
                });

                dayCell.appendChild(btn);
                row.appendChild(dayCell);
            }

            // Процент выполнения
            const percentCell = document.createElement('td');
            percentCell.className = 'percent-cell';
            const percent = this.calculateHabitPercent(habit.id);
            percentCell.textContent = `${percent}%`;
            percentCell.setAttribute('data-habit-id', habit.id);
            if (percent >= 70) {
                percentCell.classList.add('high');
            } else if (percent >= 40) {
                percentCell.classList.add('medium');
            } else {
                percentCell.classList.add('low');
            }
            row.appendChild(percentCell);

            tbody.appendChild(row);
        });

        this.updateStats();
    }

    // Редактирование названия привычки
    editHabitName(habitId, cell) {
        const habit = this.habits.find(h => h.id === habitId);
        if (!habit) return;

        cell.classList.add('editing');
        const input = document.createElement('input');
        input.type = 'text';
        input.value = habit.name;
        input.addEventListener('blur', async () => {
            habit.name = input.value.trim() || `Привычка ${this.habits.indexOf(habit) + 1}`;
            await this.saveData();
            this.renderTable();
        });
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                input.blur();
            }
        });
        cell.innerHTML = '';
        cell.appendChild(input);
        input.focus();
    }

    // Добавление новой привычки
    async addHabit() {
        const newId = `habit-${Date.now()}`;
        this.habits.push({
            id: newId,
            name: `Привычка ${this.habits.length + 1}`
        });
        await this.saveData();
        this.renderTable();
    }

    // Переключение месяца
    async changeMonth(direction) {
        if (direction === 'prev') {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        } else {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        }
        await this.saveData();
        this.updateMonthDisplay();
        this.renderTable();
    }

    // Обновление отображения месяца
    updateMonthDisplay() {
        const monthNames = [
            'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
            'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
        ];
        const monthDisplay = document.getElementById('currentMonth');
        if (monthDisplay) {
            monthDisplay.textContent = `${monthNames[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
        }
    }

    // Настройка обработчиков событий
    setupEventListeners() {
        document.getElementById('prevMonth')?.addEventListener('click', () => {
            this.changeMonth('prev');
        });

        document.getElementById('nextMonth')?.addEventListener('click', () => {
            this.changeMonth('next');
        });

        document.getElementById('addHabit')?.addEventListener('click', () => {
            this.addHabit();
        });

        document.getElementById('viewCharts')?.addEventListener('click', () => {
            this.showCharts();
        });

        document.getElementById('closeCharts')?.addEventListener('click', () => {
            this.hideCharts();
        });
    }

    // Показать диаграммы
    showCharts() {
        const chartsSection = document.getElementById('chartsSection');
        chartsSection.classList.remove('hidden');
        this.renderCharts();
    }

    // Скрыть диаграммы
    hideCharts() {
        const chartsSection = document.getElementById('chartsSection');
        chartsSection.classList.add('hidden');
    }

    // Рендеринг диаграмм
    renderCharts() {
        this.renderOverallChart();
        this.renderHabitsChart();
        this.renderDailyChart();
    }

    // Общая статистика
    renderOverallChart() {
        const ctx = document.getElementById('overallChart');
        if (!ctx) return;

        const totalPercent = this.calculateTotalPercent();
        
        // Уничтожаем предыдущий график если есть
        if (this.overallChart) {
            this.overallChart.destroy();
        }

        this.overallChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Выполнено', 'Не выполнено'],
                datasets: [{
                    data: [totalPercent, 100 - totalPercent],
                    backgroundColor: ['#4caf50', '#e0e0e0'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    title: {
                        display: true,
                        text: `Общая эффективность: ${totalPercent}%`,
                        font: {
                            size: 16
                        }
                    }
                }
            }
        });
    }

    // Статистика по привычкам
    renderHabitsChart() {
        const ctx = document.getElementById('habitsChart');
        if (!ctx) return;

        const labels = this.habits.map(h => h.name);
        const data = this.habits.map(h => this.calculateHabitPercent(h.id));

        if (this.habitsChart) {
            this.habitsChart.destroy();
        }

        this.habitsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Процент выполнения',
                    data: data,
                    backgroundColor: data.map(p => {
                        if (p >= 70) return '#4caf50';
                        if (p >= 40) return '#ff9800';
                        return '#f44336';
                    }),
                    borderColor: data.map(p => {
                        if (p >= 70) return '#388e3c';
                        if (p >= 40) return '#f57c00';
                        return '#d32f2f';
                    }),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    // Детальный анализ по дням
    renderDailyChart() {
        const ctx = document.getElementById('dailyChart');
        if (!ctx) return;

        const daysInMonth = this.getDaysInMonth();
        const labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
        
        // Подсчет выполненных задач по дням
        const completedByDay = labels.map(day => {
            return this.habits.reduce((count, habit) => {
                if (this.getHabitStatus(habit.id, day) === 'plus') {
                    return count + 1;
                }
                return count;
            }, 0);
        });

        if (this.dailyChart) {
            this.dailyChart.destroy();
        }

        this.dailyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Выполнено задач',
                    data: completedByDay,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: this.habits.length,
                        ticks: {
                            stepSize: 1
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                }
            }
        });
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    window.tracker = new HabitTracker();
});
