// data.js - Handles State and LocalStorage

const STORAGE_KEY = 'cashflow_tracker_data';

// Default initial state if empty
const defaultData = {
    wallets: [
        { id: 'tunai', name: 'Tunai', balance: 0, type: 'cash', theme: 'theme-green', icon: 'ri-money-dollar-circle-line' },
        { id: 'rekening_utama', name: 'Rekening Utama', balance: 0, type: 'bank', theme: 'theme-blue', icon: 'ri-bank-card-line' },
        { id: 'ewallet', name: 'E-Wallet', balance: 0, type: 'ewallet', theme: 'theme-purple', icon: 'ri-smartphone-line' },
        { id: 'hutang', name: 'Hutang Saya', balance: 0, type: 'debt', theme: 'theme-red', icon: 'ri-arrow-down-circle-line' },
        { id: 'piutang', name: 'Piutang Orang', balance: 0, type: 'receivable', theme: 'theme-green', icon: 'ri-arrow-up-circle-line' }
    ],
    assets: [
        { id: 'emas', name: 'Emas', unit: 0, price: 1250000, type: 'gold', theme: 'theme-gold', icon: 'ri-vip-diamond-line', unitLabel: 'gr' },
        { id: 'crypto', name: 'Kripto (BTC)', unit: 0, price: 1050000000, type: 'crypto', theme: 'theme-blue', icon: 'ri-bit-coin-line', unitLabel: 'BTC' },
        { id: 'saham', name: 'Saham', unit: 0, price: 0, type: 'stock', theme: 'theme-green', icon: 'ri-stock-line', unitLabel: 'lot' }
    ],
    transactions: [],
    budget: {
        target: 3000000
    }
};

class DataService {
    constructor() {
        this.data = this.loadData();
    }

    loadData() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
        this.saveData(defaultData);
        return { ...defaultData };
    }

    saveData(data = this.data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        this.data = data;
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
    }

    formatNumber(number, decimals = 2) {
        return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: decimals }).format(number);
    }

    async fetchLiveMarket() {
        try {
            // Fetching Gold & Crypto (BTC) prices from a public API mock/CoinGecko
            // Using CoinGecko for BTC to IDR
            const resBtc = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=idr');
            if (resBtc.ok) {
                const dataBtc = await resBtc.json();
                const btcToIdr = dataBtc.bitcoin.idr;
                const btcIndex = this.data.assets.findIndex(a => a.id === 'crypto');
                if (btcIndex > -1) {
                    this.data.assets[btcIndex].price = btcToIdr;
                    this.saveData();
                }
            }
            // For gold, usually public APIs require auth. Let's mock a daily fluctuation for demo.
            const goldIndex = this.data.assets.findIndex(a => a.id === 'emas');
            if (goldIndex > -1) {
                // Static 1,250,000 +/- random small var
                const base = 1250000;
                const variance = Math.floor(Math.random() * 20000) - 10000;
                this.data.assets[goldIndex].price = base + variance;
                this.saveData();
            }
        } catch (e) {
            console.error("Failed to fetch live market", e);
        }
    }

    getNetWorth() {
        const totalWallets = this.data.wallets
            .filter(w => w.type !== 'debt') // sum positive wallets
            .reduce((sum, w) => sum + w.balance, 0);

        const totalDebt = this.data.wallets
            .filter(w => w.type === 'debt')
            .reduce((sum, w) => sum + w.balance, 0);

        const totalInvestment = this.data.assets.reduce((sum, a) => sum + (a.unit * a.price), 0);

        return {
            total: (totalWallets + totalInvestment) - totalDebt,
            wallets: totalWallets - totalDebt,
            investment: totalInvestment
        };
    }
 addWallet(name, type, balance) {
        // Tentukan tema dan icon berdasarkan tipe dompet
        let theme = 'theme-blue';
        let icon = 'ri-wallet-3-line';

        if (type === 'cash') {
            theme = 'theme-green';
            icon = 'ri-money-dollar-circle-line';
        } else if (type === 'ewallet') {
            theme = 'theme-purple';
            icon = 'ri-smartphone-line';
        } else if (type === 'bank') {
            theme = 'theme-blue';
            icon = 'ri-bank-card-line';
        }

        const newWallet = {
            id: 'wallet_' + Date.now(), // Buat ID unik
            name: name,
            type: type,
            balance: parseFloat(balance) || 0,
            theme: theme,
            icon: icon
        };

        this.data.wallets.push(newWallet);
        this.saveData();
        return newWallet;
    }
    addTransaction(tx) {
        const newTx = {
            id: Date.now().toString(),
            ...tx
        };

        // Update wallet balance
        const walletIndex = this.data.wallets.findIndex(w => w.id === tx.walletId);
        if (walletIndex > -1) {
            if (tx.type === 'expense') {
                this.data.wallets[walletIndex].balance -= parseFloat(tx.amount);
            } else if (tx.type === 'income') {
                this.data.wallets[walletIndex].balance += parseFloat(tx.amount);
            }
            // If transfer, handle both (will need a 'toWalletId' in future upgrade)
        }

        this.data.transactions.unshift(newTx);
        // keep only recent 100 to avoid storage bloat in localstorage
        if (this.data.transactions.length > 100) this.data.transactions.pop();

        this.saveData();
        return newTx;
    }

    getMonthlyStats(monthOffset = 0) {
        const now = new Date();
        now.setMonth(now.getMonth() - monthOffset);
        const targetMonth = now.getMonth();
        const targetYear = now.getFullYear();

        let income = 0;
        let expense = 0;
        let categories = {}; // For pie chart

        this.data.transactions.forEach(tx => {
            const txDate = new Date(tx.date);
            if (txDate.getMonth() === targetMonth && txDate.getFullYear() === targetYear) {
                if (tx.type === 'income') income += tx.amount;
                if (tx.type === 'expense') {
                    expense += tx.amount;
                    if (!categories[tx.category]) categories[tx.category] = 0;
                    categories[tx.category] += tx.amount;
                }
            }
        });

        return { income, expense, categories };
    }
}

// Global instance
const db = new DataService();
