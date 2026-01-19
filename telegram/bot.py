#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Простой Telegram бот для запуска трекера привычек (Mini App)
"""

import os
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import Application, CommandHandler, ContextTypes

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Получаем токен бота из переменной окружения или используем значение по умолчанию
BOT_TOKEN = os.getenv('BOT_TOKEN', '8560639679:AAFh7Xy7mBmgxx9Rg6_1XAWbL9nYxuNHGII')
# URL вашего Mini App (замените на ваш реальный URL после размещения)
WEB_APP_URL = os.getenv('WEB_APP_URL', 'https://yourdomain.com/habit-tracker/telegram/')

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик команды /start"""
    user = update.effective_user
    
    # Создаем кнопку для открытия Mini App
    keyboard = [
        [InlineKeyboardButton(
            "📊 Открыть трекер привычек",
            web_app=WebAppInfo(url=WEB_APP_URL)
        )]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    welcome_message = (
        f"Привет, {user.first_name}! 👋\n\n"
        "Добро пожаловать в трекер привычек!\n\n"
        "Нажмите на кнопку ниже, чтобы открыть приложение и начать отслеживать свои привычки."
    )
    
    await update.message.reply_text(
        welcome_message,
        reply_markup=reply_markup
    )

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик команды /help"""
    help_text = (
        "📚 Помощь по использованию трекера привычек:\n\n"
        "• Нажмите кнопку 'Открыть трекер привычек' для запуска приложения\n"
        "• В приложении вы можете:\n"
        "  - Отмечать выполнение привычек каждый день\n"
        "  - Редактировать названия привычек (клик по названию)\n"
        "  - Переключаться между месяцами\n"
        "  - Просматривать статистику и диаграммы\n"
        "  - Добавлять новые привычки\n\n"
        "Ваши данные сохраняются автоматически!"
    )
    await update.message.reply_text(help_text)

def main() -> None:
    """Запуск бота"""
    if BOT_TOKEN == 'YOUR_BOT_TOKEN_HERE':
        logger.error("Пожалуйста, установите BOT_TOKEN в переменной окружения или в коде!")
        return
    
    # Создаем приложение
    application = Application.builder().token(BOT_TOKEN).build()
    
    # Регистрируем обработчики команд
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("help", help_command))
    
    # Запускаем бота
    logger.info("Бот запущен...")
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == '__main__':
    main()
