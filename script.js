// Google Sheets Configuration
const SHEET_CONFIG = {
    // Заменете с вашия Google Sheets API key
    API_KEY: 'YOUR_GOOGLE_SHEETS_API_KEY',
    // ID на вашия Google Sheets документ
    SHEET_ID: '1n2WYI0WVIS3kGdn40IKlfa_frQx_95-RIyta2QyPFXM',
    // GID на конкретния лист
    GID: '1782469559',
    // Името на листа в Google Sheets
    RANGE: 'Sheet1!A:D' // Колони: Дата, Описание, Тип, Сума
};

class NurseryCashRegister {
    constructor() {
        this.transactions = [];
        this.summary = {
            totalIncome: 0,
            totalExpenses: 0,
            balance: 0
        };
        
        this.initializeApp();
    }

    initializeApp() {
        this.setupEventListeners();
        this.populateMonthFilter();
        this.loadTransactions();
    }

    setupEventListeners() {
        const refreshBtn = document.getElementById('refresh-btn');
        const incomeBtn = document.getElementById('income-btn');
        const expenseBtn = document.getElementById('expense-btn');
        const monthFilter = document.getElementById('month-filter');

        refreshBtn.addEventListener('click', () => this.loadTransactions());
        incomeBtn.addEventListener('click', () => this.showIncomeOnly());
        expenseBtn.addEventListener('click', () => this.showExpensesOnly());
        monthFilter.addEventListener('change', () => this.filterTransactions());
    }

    populateMonthFilter() {
        const monthFilter = document.getElementById('month-filter');
        const months = [
            'Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни',
            'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'
        ];

        months.forEach((month, index) => {
            const option = document.createElement('option');
            option.value = index + 1;
            option.textContent = month;
            monthFilter.appendChild(option);
        });
    }

    async loadTransactions() {
        this.showLoading(true);
        
        try {
            // Опитваме първо да заредим от Google Sheets като CSV с правилния GID
            const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_CONFIG.SHEET_ID}/export?format=csv&gid=${SHEET_CONFIG.GID}`;
            
            try {
                const response = await fetch(csvUrl);
                
                if (response.ok) {
                    const csvText = await response.text();
                    this.processCSVData(csvText);
                    return;
                }
            } catch (csvError) {
                console.log('CSV метод неуспешен, опитваме с API...');
            }

            // Ако CSV не работи, опитваме с API
            if (SHEET_CONFIG.API_KEY !== 'YOUR_GOOGLE_SHEETS_API_KEY') {
                const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_CONFIG.SHEET_ID}/values/${SHEET_CONFIG.RANGE}?key=${SHEET_CONFIG.API_KEY}`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                this.processSheetData(data.values);
                return;
            }

            // Ако нито един метод не работи, използваме демо данни
            throw new Error('Няма достъп до Google Sheets');
            
        } catch (error) {
            console.error('Грешка при зареждане на данните:', error);
            this.showError('Не можах да заредя данните от Google Sheets. Моля, уверете се, че документът е публично достъпен. Използват се демо данни.');
            this.loadDemoData();
        } finally {
            this.showLoading(false);
        }
    }

    processCSVData(csvText) {
        console.log('Получени CSV данни:', csvText.substring(0, 500) + '...');
        
        const lines = csvText.split('\n').filter(line => line.trim());
        
        if (lines.length <= 1) {
            this.showError('Няма налични данни в CSV.');
            return;
        }

        console.log(`Намерени ${lines.length} реда в CSV`);
        console.log('Първи ред (заглавия):', lines[0]);
        
        // Пропускаме заглавния ред
        const dataRows = lines.slice(1).map(line => {
            // По-добър CSV parser който се справя с запетаи в кавички
            const fields = this.parseCSVLine(line);
            return fields;
        });

        console.log('Пример от данни:', dataRows.slice(0, 3));

        this.transactions = dataRows.map((row, index) => ({
            id: index + 1,
            date: this.parseDate(row[0] || ''),
            description: row[1] || 'Без описание',
            type: row[2] || 'Неизвестен',
            amount: this.parseAmount(row[3] || '0')
        })).filter(transaction => {
            const valid = transaction.date && !isNaN(transaction.amount) && transaction.amount !== 0;
            if (!valid) {
                console.log('Невалидна транзакция:', transaction);
            }
            return valid;
        });

        console.log(`Обработени ${this.transactions.length} валидни транзакции`);

        this.calculateSummary();
        this.displayTransactions();
        this.updateSummaryDisplay();
        
        // Добавяме визуална индикация за всички транзакции
        const statusDiv = document.getElementById('connection-status');
        if (statusDiv) {
            statusDiv.innerHTML = '<span style="color: blue;">📊 Показани са всички транзакции</span>';
        }
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.trim());
        return result;
    }

    processSheetData(rows) {
        if (!rows || rows.length <= 1) {
            this.showError('Няма налични данни.');
            return;
        }

        // Пропускаме заглавния ред
        const dataRows = rows.slice(1);
        
        this.transactions = dataRows.map((row, index) => ({
            id: index + 1,
            date: this.parseDate(row[0] || ''),
            description: row[1] || 'Без описание',
            type: row[2] || 'Неизвестен',
            amount: this.parseAmount(row[3] || '0')
        })).filter(transaction => transaction.date && !isNaN(transaction.amount) && transaction.amount !== 0);

        this.calculateSummary();
        this.displayTransactions();
        this.updateSummaryDisplay();
        
        // Добавяме визуална индикация за всички транзакции
        const statusDiv = document.getElementById('connection-status');
        if (statusDiv) {
            statusDiv.innerHTML = '<span style="color: blue;">📊 Показани са всички транзакции</span>';
        }
    }

    loadDemoData() {
        // Демо данни за тестване
        this.transactions = [
            { id: 1, date: new Date('2024-10-01'), description: 'Такса за храна - октомври', type: 'Приход', amount: 250.00 },
            { id: 2, date: new Date('2024-10-02'), description: 'Покупка на играчки', type: 'Разход', amount: -45.50 },
            { id: 3, date: new Date('2024-10-03'), description: 'Дарение от родители', type: 'Приход', amount: 100.00 },
            { id: 4, date: new Date('2024-10-05'), description: 'Почистващи препарати', type: 'Разход', amount: -25.80 },
            { id: 5, date: new Date('2024-10-08'), description: 'Такса за дейности', type: 'Приход', amount: 150.00 },
            { id: 6, date: new Date('2024-10-10'), description: 'Материали за рисуване', type: 'Разход', amount: -30.20 },
            { id: 7, date: new Date('2024-10-12'), description: 'Допълнителна такса', type: 'Приход', amount: 75.00 },
            { id: 8, date: new Date('2024-10-15'), description: 'Храна и напитки', type: 'Разход', amount: -85.60 },
            { id: 9, date: new Date('2024-10-18'), description: 'Събитие в градината', type: 'Приход', amount: 200.00 },
            { id: 10, date: new Date('2024-10-20'), description: 'Ремонт на оборудване', type: 'Разход', amount: -120.00 }
        ];

        this.calculateSummary();
        this.displayTransactions();
        this.updateSummaryDisplay();
        
        // Добавяме визуална индикация за всички транзакции
        const statusDiv = document.getElementById('connection-status');
        if (statusDiv) {
            statusDiv.innerHTML = '<span style="color: blue;">📊 Показани са всички транзакции</span>';
        }
    }

    parseDate(dateString) {
        if (!dateString) return null;
        
        // Опитваме различни формати на дата
        const formats = [
            /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
            /^\d{2}\/\d{2}\/\d{4}$/, // DD/MM/YYYY
            /^\d{2}\.\d{2}\.\d{4}$/ // DD.MM.YYYY
        ];

        for (const format of formats) {
            if (format.test(dateString)) {
                return new Date(dateString);
            }
        }

        return new Date(dateString);
    }

    parseAmount(amountString) {
        if (typeof amountString === 'number') return amountString;
        if (!amountString || amountString.toString().trim() === '') return 0;
        
        // Премахваме всички символи освен цифри, точка, запетая и минус
        let cleanAmount = amountString.toString().trim()
            .replace(/[^\d.,-]/g, '') // Премахваме всички символи освен цифри и . , -
            .replace(/,/g, '.'); // Заменяме запетаи с точки
            
        // Ако започва с минус, запазваме го
        const isNegative = cleanAmount.startsWith('-');
        cleanAmount = cleanAmount.replace('-', '');
        
        const amount = parseFloat(cleanAmount) || 0;
        return isNegative ? -amount : amount;
    }

    calculateSummary() {
        this.summary = {
            totalIncome: 0,
            totalExpenses: 0,
            balance: 0
        };

        this.transactions.forEach(transaction => {
            if (transaction.amount > 0) {
                this.summary.totalIncome += transaction.amount;
            } else {
                this.summary.totalExpenses += Math.abs(transaction.amount);
            }
        });

        this.summary.balance = this.summary.totalIncome - this.summary.totalExpenses;
    }

    updateSummaryDisplay() {
        document.getElementById('total-income').textContent = this.formatCurrency(this.summary.totalIncome);
        document.getElementById('total-expenses').textContent = this.formatCurrency(this.summary.totalExpenses);
        document.getElementById('balance').textContent = this.formatCurrency(this.summary.balance);
    }

    displayTransactions() {
        const tbody = document.getElementById('transactions-body');
        tbody.innerHTML = '';

        if (this.transactions.length === 0) {
            const row = tbody.insertRow();
            const cell = row.insertCell(0);
            cell.colSpan = 4;
            cell.textContent = 'Няма налични транзакции';
            cell.style.textAlign = 'center';
            cell.style.padding = '2rem';
            return;
        }

        // Сортираме транзакциите по дата (най-новите първо)
        const sortedTransactions = [...this.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

        sortedTransactions.forEach(transaction => {
            const row = tbody.insertRow();
            
            // Дата
            const dateCell = row.insertCell(0);
            dateCell.textContent = this.formatDate(transaction.date);
            
            // Описание
            const descCell = row.insertCell(1);
            descCell.textContent = transaction.description;
            
            // Тип
            const typeCell = row.insertCell(2);
            typeCell.textContent = transaction.type;
            
            // Сума
            const amountCell = row.insertCell(3);
            amountCell.textContent = this.formatCurrency(Math.abs(transaction.amount));
            amountCell.className = transaction.amount > 0 ? 'transaction-income' : 'transaction-expense';
        });

        document.getElementById('transactions-table').classList.remove('hidden');
    }

    showIncomeOnly() {
        // Филтрираме само приходите
        const incomeTransactions = this.transactions.filter(transaction => 
            transaction.amount > 0 || 
            transaction.type.toLowerCase().includes('приход')
        );

        // Временно запазваме оригиналните транзакции
        const originalTransactions = [...this.transactions];
        
        // Показваме филтрираните транзакции, но запазваме оригиналната статистика
        const tempTransactions = [...this.transactions];
        this.transactions = incomeTransactions;
        this.displayTransactions();
        this.transactions = tempTransactions;

        // Добавяме визуална индикация
        const statusDiv = document.getElementById('connection-status');
        if (statusDiv) {
            statusDiv.innerHTML = '<span style="color: green;">📈 Показани са само приходите</span>';
        }
    }

    showExpensesOnly() {
        // Филтрираме само разходите
        const expenseTransactions = this.transactions.filter(transaction => 
            transaction.amount < 0 || 
            transaction.type.toLowerCase().includes('разход')
        );

        // Временно запазваме оригиналните транзакции
        const originalTransactions = [...this.transactions];
        
        // Показваме филтрираните транзакции, но запазваме оригиналната статистика
        const tempTransactions = [...this.transactions];
        this.transactions = expenseTransactions;
        this.displayTransactions();
        this.transactions = tempTransactions;

        // Добавяме визуална индикация
        const statusDiv = document.getElementById('connection-status');
        if (statusDiv) {
            statusDiv.innerHTML = '<span style="color: red;">📉 Показани са само разходите</span>';
        }
    }

    filterTransactions() {
        const monthFilter = document.getElementById('month-filter');
        const selectedMonth = monthFilter.value;

        if (!selectedMonth) {
            this.displayTransactions();
            return;
        }

        const filteredTransactions = this.transactions.filter(transaction => {
            return new Date(transaction.date).getMonth() + 1 === parseInt(selectedMonth);
        });

        // Временно запазваме оригиналните транзакции
        const originalTransactions = [...this.transactions];
        this.transactions = filteredTransactions;
        
        this.calculateSummary();
        this.displayTransactions();
        this.updateSummaryDisplay();
        
        // Връщаме оригиналните транзакции
        this.transactions = originalTransactions;
    }

    formatDate(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        
        return date.toLocaleDateString('bg-BG', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('bg-BG', {
            style: 'currency',
            currency: 'BGN',
            minimumFractionDigits: 2
        }).format(amount);
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        const table = document.getElementById('transactions-table');
        
        if (show) {
            loading.classList.remove('hidden');
            table.classList.add('hidden');
        } else {
            loading.classList.add('hidden');
        }
    }

    async testConnection() {
        const statusDiv = document.getElementById('connection-status');
        statusDiv.innerHTML = '<span style="color: orange;">🔄 Тествам връзката...</span>';
        
        try {
            const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_CONFIG.SHEET_ID}/export?format=csv&gid=${SHEET_CONFIG.GID}`;
            console.log('Тестов URL:', csvUrl);
            
            const response = await fetch(csvUrl);
            
            if (response.ok) {
                const csvText = await response.text();
                console.log('Получени данни:', csvText.substring(0, 200) + '...');
                
                const lines = csvText.split('\n').filter(line => line.trim());
                
                if (lines.length > 1) {
                    statusDiv.innerHTML = `<span style="color: green;">✅ Връзката работи! Намерени ${lines.length - 1} реда данни.<br>Първи ред: "${lines[0]}"</span>`;
                } else {
                    statusDiv.innerHTML = `<span style="color: orange;">⚠️ Връзката работи, но няма данни или само заглавия.</span>`;
                }
            } else {
                statusDiv.innerHTML = `<span style="color: red;">❌ Грешка: ${response.status}. Проверете дали документът е публично достъпен.</span>`;
            }
        } catch (error) {
            statusDiv.innerHTML = `<span style="color: red;">❌ Грешка при свързване: ${error.message}</span>`;
            console.error('Детайлна грешка:', error);
        }
    }

    showError(message) {
        console.error(message);
        const statusDiv = document.getElementById('connection-status');
        if (statusDiv) {
            statusDiv.innerHTML = `<span style="color: red;">❌ ${message}</span>`;
        }
    }
}

// Инициализираме приложението когато страницата е заредена
document.addEventListener('DOMContentLoaded', () => {
    new NurseryCashRegister();
});

// Експортираме класа за тестване (ако е необходимо)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NurseryCashRegister;
}