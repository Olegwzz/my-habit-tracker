@echo off
chcp 65001 >nul
echo ============================================
echo  Запуск Telegram бота - Трекер привычек
echo ============================================
echo.

cd /d "%~dp0"

echo Проверка зависимостей...
python -m pip install python-telegram-bot --quiet

echo.
echo Запуск бота...
echo Нажмите Ctrl+C для остановки
echo.

python bot.py

pause
