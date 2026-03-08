// data.js - Handles State and LocalStorage

const STORAGE_KEY = 'cashflow_tracker_data';

// Default initial state if empty
const defaultData = {
    wallets: [
        { id: 'tunai', name: 'Tunai', balance: 0, type: 'cash', theme: 'theme-green', icon: 'ri-money-dollar-circle-line', account: '' },
        { id: 'rekening_utama', name: 'Rekening Utama', balance: 0, type: 'bank', theme: 'theme-blue', icon: 'ri-bank-card-line', account: '1234567890' },
        { id: 'ewallet', name: 'E-Wallet', balance: 0, type: 'ewallet', theme: 'theme-purple', icon: 'ri-smartphone-line', account: '08123456789' },
        { id: 'hutang', name: 'Hutang Saya', balance: 0, type: 'debt', theme: 'theme-red', icon: 'ri-arrow-down-circle-line', account: '' },
        { id: 'piutang', name: 'Piutang Orang', balance: 0, type: 'receivable', theme: 'theme-green', icon: 'ri-arrow-up-circle-line', account: '' }
    ],
    debts: [],
    assets: [
        { id: 'emas', name: 'Emas', unit: 0, price: 1250000, type: 'gold', theme: 'theme-gold', icon: 'ri-vip-diamond-line', unitLabel: 'gr' },
        { id: 'crypto', name: 'Kripto', unit: 0, price: 1050000000, type: 'crypto', theme: 'theme-blue', icon: 'ri-bit-coin-line', unitLabel: 'coin' },
        { id: 'saham', name: 'Saham', unit: 0, price: 0, type: 'stock', theme: 'theme-green', icon: 'ri-stock-line', unitLabel: 'lot' }
    ],
    transactions: [],
    categories: ['Makan & Minum', 'Transportasi', 'Tagihan', 'Belanja', 'Hiburan', 'Lainnya'],
    contacts: [],
    goals: [],
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
            const loaded = JSON.parse(stored);
            // Initialize categories if they don't exist in loaded data (for backward compatibility)
            if(!loaded.categories) {
                loaded.categories = [...defaultData.categories];
                this.data = loaded;
                this.saveData();
            }
            if(!loaded.contacts) {
                loaded.contacts = [];
                this.data = loaded;
                this.saveData();
            }
            if(!loaded.goals) {
                loaded.goals = [];
                this.data = loaded;
                this.saveData();
            }
            return loaded;
        }
        this.saveData(defaultData);
        return { ...defaultData };
    }

    saveData(data = this.data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        this.data = data;
    }

    addCategory(name) {
        if (!this.data.categories.includes(name)) {
            this.data.categories.push(name);
            this.saveData();
        }
    }

    addContact(name, account) {
        if (!name || !account) return;
        // Remove existing if matching account to put it at the front (recent)
        this.data.contacts = this.data.contacts.filter(c => c.account !== account);
        this.data.contacts.unshift({
            id: 'c_' + Date.now(),
            name: name,
            account: account,
            lastUsed: Date.now()
        });
        // Limit to 20 recent contacts to prevent overflow
        if (this.data.contacts.length > 20) this.data.contacts.pop();
        this.saveData();
    }

    addGoal(name, targetAmount, walletId, targetDate) {
        this.data.goals.push({
            id: 'g_' + Date.now(),
            name,
            targetAmount: parseFloat(targetAmount),
            walletId,
            targetDate,
            createdAt: new Date().toISOString()
        });
        this.saveData();
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
    }

    formatNumber(number, decimals = 2) {
        return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: decimals }).format(number);
    }

    async fetchLiveMarket() {
        try {
            // Apply slight random fluctuations to all dynamic assets to simulate live market
            // In a real app, you would fetch real tickers based on the asset's specific ticker symbol
            this.data.assets.forEach(a => {
                const variance = (Math.random() * 0.02) - 0.01; // +/- 1%
                a.price = Math.round(a.price * (1 + variance));
            });
            this.saveData();

            // Attempt BTC fetch just for the main Kripto if it exists
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
    addWallet(name, type, balance, account) {
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
            icon: icon,
            account: account || ''
        };

        this.data.wallets.push(newWallet);
        this.saveData();
        return newWallet;
    }

    deleteWallet(id) {
        // Mencegah penghapusan dompet default sistem (Hutang & Piutang)
        if (id === 'hutang' || id === 'piutang') return false;
        
        this.data.wallets = this.data.wallets.filter(w => w.id !== id);
        this.saveData();
        return true;
    }

    updateWallet(id, name, type, balance, account) {
        const wallet = this.data.wallets.find(w => w.id === id);
        if(wallet) {
            wallet.name = name;
            wallet.type = type;
            wallet.balance = parseFloat(balance) || 0;
            wallet.account = account || '';
            
            // Set default theme styling based on type
            if (type === 'ewallet') { wallet.theme = 'theme-purple'; wallet.icon = 'ri-smartphone-line'; }
            else if (type === 'bank') { wallet.theme = 'theme-blue'; wallet.icon = 'ri-bank-card-line'; }
            else { wallet.theme = 'theme-green'; wallet.icon = 'ri-money-dollar-circle-line'; }
            
            this.saveData();
            return true;
        }
        return false;
    }

    addAsset(name, type, unit, unitLabel, price) {
        let theme = 'theme-yellow', icon = 'ri-vip-crown-line';
        if (type === 'crypto') { theme = 'theme-orange'; icon = 'ri-bit-coin-line'; }
        else if (type === 'stock') { theme = 'theme-blue'; icon = 'ri-line-chart-line'; }

        const newAsset = {
            id: 'asset_' + Date.now(),
            type, name, unit: parseFloat(unit) || 0,
            unitLabel, price: parseFloat(price) || 0,
            theme, icon
        };
        this.data.assets.push(newAsset);
        this.saveData();
        return newAsset;
    }

    updateAsset(id, name, type, unit, unitLabel, price) {
        const asset = this.data.assets.find(a => a.id === id);
        if (asset) {
            asset.name = name;
            asset.type = type;
            asset.unit = parseFloat(unit) || 0;
            asset.unitLabel = unitLabel;
            asset.price = parseFloat(price) || 0;
            if (type === 'crypto') { asset.theme = 'theme-orange'; asset.icon = 'ri-bit-coin-line'; }
            else if (type === 'stock') { asset.theme = 'theme-blue'; asset.icon = 'ri-line-chart-line'; }
            else { asset.theme = 'theme-yellow'; asset.icon = 'ri-vip-crown-line'; }
            this.saveData();
            return true;
        }
        return false;
    }

    deleteAsset(id) {
        this.data.assets = this.data.assets.filter(a => a.id !== id);
        this.saveData();
    }

    addDebt(type, name, phone, amount, proofImage) {
        const debt = {
            id: 'debt_' + Date.now(),
            type: type, // 'hutang' or 'piutang'
            name: name,
            phone: phone,
            amount: parseFloat(amount) || 0,
            proofImage: proofImage, // base64
            status: 'pending', // 'pending' or 'paid'
            date: new Date().toISOString()
        };
        this.data.debts.push(debt);
        this.recalculateDebtWallets();
        return debt;
    }

    resolveDebt(id) {
        const debt = this.data.debts.find(d => d.id === id);
        if(debt) {
            debt.status = debt.status === 'pending' ? 'paid' : 'pending';
            this.recalculateDebtWallets();
        }
    }

    updateDebt(id, type, name, phone, amount, proofImage) {
        const debt = this.data.debts.find(d => d.id === id);
        if(debt) {
            debt.type = type;
            debt.name = name;
            debt.phone = phone || '';
            debt.amount = parseFloat(amount) || 0;
            if(proofImage) debt.proofImage = proofImage;
            this.recalculateDebtWallets();
            return true;
        }
        return false;
    }

    recalculateDebtWallets() {
        const hutangWallet = this.data.wallets.find(w => w.id === 'hutang');
        const piutangWallet = this.data.wallets.find(w => w.id === 'piutang');

        if(hutangWallet) {
            hutangWallet.balance = this.data.debts
                .filter(d => d.type === 'hutang' && d.status !== 'paid')
                .reduce((acc, curr) => acc + curr.amount, 0);
        }
        if(piutangWallet) {
            piutangWallet.balance = this.data.debts
                .filter(d => d.type === 'piutang' && d.status !== 'paid')
                .reduce((acc, curr) => acc + curr.amount, 0);
        }
        this.saveData();
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
