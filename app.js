// app.js - UI Rendering and View Controller

class AppController {
    constructor() {
        this.currentView = 'home';
        this.isPrivacyMode = false;

        this.init();
    }

    init() {
        this.cacheDOM();
        this.bindEvents();

        // Initial Fetch and Render
        db.fetchLiveMarket().then(() => this.render());
        this.render();
    }

    cacheDOM() {
        this.views = document.querySelectorAll('.view');
        this.navItems = document.querySelectorAll('.nav-item[data-target]');
        this.pageTitle = document.getElementById('page-title');

        // Header
        this.btnPrivacy = document.getElementById('btn-privacy');

        // Modals
        this.modalAdd = document.getElementById('add-transaction-modal');
        this.btnAdd = document.getElementById('btn-add-transaction');

        this.modalAddWallet = document.getElementById('add-wallet-modal');
        this.btnAddWallet = document.getElementById('btn-add-wallet');

        this.btnCloses = document.querySelectorAll('.modal-close');

        // Form Elements
        this.formTx = document.getElementById('form-transaction');
        this.formWallet = document.getElementById('form-add-wallet');
        this.txTypeBtns = document.querySelectorAll('.type-btn');
        this.txWalletSelect = document.getElementById('tx-wallet');
        this.currentTxType = 'expense';
    }

    bindEvents() {
        // Navigation
        this.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigate(item.dataset.target);
            });
        });

        // Toggle Privacy Mode
        this.btnPrivacy.addEventListener('click', () => {
            this.isPrivacyMode = !this.isPrivacyMode;
            this.btnPrivacy.innerHTML = this.isPrivacyMode ? '<i class="ri-eye-off-line"></i>' : '<i class="ri-eye-line"></i>';
            this.render(); // Re-render to hide/show balances
        });

        // Modals Add Transaction
        this.btnAdd.addEventListener('click', () => {
            this.updateWalletSelect();
            this.openModal(this.modalAdd);
        });

        // Modals Add Wallet
        this.btnAddWallet.addEventListener('click', () => {
            this.openModal(this.modalAddWallet);
        });

        this.btnCloses.forEach(btn => btn.addEventListener('click', () => this.closeModals()));

        // Close on overlay click
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                this.closeModals();
            }
        });

        // Form Tx Type Selection
        this.txTypeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.txTypeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTxType = btn.dataset.type;

                // Toggle Category visibility (hide for transfer)
                const catGroup = document.getElementById('group-category');
                if (this.currentTxType === 'transfer') {
                    catGroup.style.display = 'none';
                } else {
                    catGroup.style.display = 'block';
                }
            });
        });

        // Default Date to today
        document.getElementById('tx-date').valueAsDate = new Date();

        // Submit logic moved to HTML inline onsubmit to prevent extension conflicts
    }

    updateWalletSelect() {
        // Only show actual dynamic wallets (exclude debt/receivable for now)
        const mainWallets = db.data.wallets.filter(w => !['debt', 'receivable'].includes(w.type));
        this.txWalletSelect.innerHTML = mainWallets.map(w =>
            `<option value="${w.id}">${w.name}</option>`
        ).join('');
    }

    navigate(viewId) {
        if (!viewId) return;

        this.currentView = viewId;

        // Update Title
        const titles = {
            'home': 'Beranda',
            'assets': 'Portofolio',
            'report': 'Laporan',
            'history': 'Riwayat'
        };
        this.pageTitle.innerText = titles[viewId] || 'Beranda';

        // Update active class on views
        this.views.forEach(v => {
            v.classList.remove('active');
            if (v.id === `view-${viewId}`) v.classList.add('active');
        });

        // Update active class on nav
        this.navItems.forEach(n => {
            n.classList.remove('active');
            if (n.dataset.target === viewId) n.classList.add('active');
        });

        // Scroll top
        document.querySelector('.content-area').scrollTo(0, 0);

        // Re-render specifically for charts if navigating to report
        if (viewId === 'report') this.renderReport();
    }

    openModal(modalElem) {
        modalElem.classList.add('active');
    }

    closeModals() {
        this.modalAdd.classList.remove('active');
        this.modalAddWallet.classList.remove('active');
        if (this.formTx) this.formTx.reset();
        if (this.formWallet) this.formWallet.reset();
        document.getElementById('tx-date').valueAsDate = new Date();
    }

    handleWalletSubmit() {
        const name = document.getElementById('wallet-name').value;
        const type = document.getElementById('wallet-type').value;
        const balance = document.getElementById('wallet-balance').value;

        if (!name) return alert('Nama dompet harus diisi!');

        db.addWallet(name, type, balance);

        this.closeModals();
        this.render(); // Re-render to show new wallet
        return false; // Prevent form acting default
    }
    
    deleteWallet(id, event) {
        if (event) event.stopPropagation(); // Mencegah bentrok saat klik area kartu
        if(confirm('Apakah Anda yakin ingin menghapus dompet ini? Semua aset di dalamnya ikut terhapus dari daftar utama.')) {
            const success = db.deleteWallet(id);
            if(!success) {
                alert('Dompet sistem utama tidak bisa dihapus!');
            } else {
                this.render();
                if(this.currentView === 'wallet-category') {
                     this.renderCategoryWallets();
                }
            }
        }
    }
    
    handleTransactionSubmit() {
        const amount = document.getElementById('tx-amount').value;
        const walletId = document.getElementById('tx-wallet').value;
        const category = document.getElementById('tx-category').value;
        const note = document.getElementById('tx-note').value;
        const date = document.getElementById('tx-date').value;

        if (!amount || amount <= 0) return alert('Masukkan nominal yang valid!');
        if (!walletId) return alert('Pilih dompet sumber!');
        if (!date) return alert('Pilih tanggal transaksi!');
        if (!note) return alert('Catatan transaksi harus diisi!');

        // Save to DB
        db.addTransaction({
            type: this.currentTxType,
            amount: parseFloat(amount),
            walletId,
            category: this.currentTxType === 'transfer' ? 'Transfer' : category,
            note,
            date
        });

        this.closeModals();
        this.render(); // Re-render all views with new data
        return false; // Prevent form acting default
    }

    // Helper to format text accounting for privacy mode
    displayMoney(amount) {
        if (this.isPrivacyMode) return 'Rp •••••••';
        return db.formatCurrency(amount);
    }

    render() {
        this.renderHome();
        this.renderAssets();
        this.renderReport();
        this.renderHistory();
    }

    renderHome() {
        // Net worth
        const nw = db.getNetWorth();
        document.getElementById('total-networth').innerText = this.displayMoney(nw.total);
        document.getElementById('total-wallet').innerText = this.displayMoney(nw.wallets);
        document.getElementById('total-investment').innerText = this.displayMoney(nw.investment);

        // Wallets
        const mainWalletsHTML = db.data.wallets.filter(w => !['debt', 'receivable'].includes(w.type)).map(w => `
            <div class="wallet-card ${w.theme}">
                <div class="wallet-icon"><i class="${w.icon}"></i></div>
                <div class="wallet-info mt-2">
                    <span class="label">${w.name}</span>
                    <span class="amount">${this.displayMoney(w.balance)}</span>
                </div>
            </div>
        `).join('');
        document.getElementById('wallets-grid-main').innerHTML = mainWalletsHTML;

        const secondaryWalletsHTML = db.data.wallets.filter(w => ['debt', 'receivable'].includes(w.type)).map(w => `
            <div class="wallet-card ${w.theme}">
                <div class="wallet-icon"><i class="${w.icon}"></i></div>
                <div class="wallet-info mt-2">
                    <span class="label">${w.name}</span>
                    <span class="amount">${this.displayMoney(w.balance)}</span>
                </div>
            </div>
            `;
        }).join('');
        document.getElementById('wallets-grid-main').innerHTML = mainWalletsHTML;

        // Assets Mini Grid
        const assetsHTML = db.data.assets.map(a => `
            <div class="asset-card ${a.theme}">
                <div class="asset-header">
                    <div class="asset-icon"><i class="${a.icon}"></i></div>
                    <span class="name">${a.name}</span>
                </div>
                <div class="asset-amount">${db.formatNumber(a.unit, 4)} <span class="asset-unit">${a.unitLabel}</span></div>
                <div class="asset-price ${a.id === 'emas' ? 'price-gold' : 'price-crypto'}">1 ${a.unitLabel} = ${this.displayMoney(a.price)}</div>
            </div>
        `).join('');
        document.getElementById('assets-grid-mini').innerHTML = assetsHTML;

        // Recent Activity (Max 5)
        const recentTx = db.data.transactions.slice(0, 5).map(tx => this.generateTxHTML(tx)).join('');
        document.getElementById('recent-transactions').innerHTML = recentTx || '<div class="text-center text-muted pt-3">Belum ada transaksi</div>';
    }
    
       renderCategoryWallets() {
        const filteredW = db.data.wallets.filter(w => w.type === this.currentWalletCategory);
        
        const walletListHTML = filteredW.length > 0 ? filteredW.map(w => {
            const chipHTML = w.type !== 'cash' ? `<div class="card-chip"></div>` : '';
            const hideDelete = (w.id === 'hutang' || w.id === 'piutang') ? 'style="display:none;"' : '';
            
            return `
            <div class="wallet-detail-card ${w.theme}">
                <button class="btn-delete-wallet" onclick="app.deleteWallet('${w.id}', event)" ${hideDelete} title="Hapus Dompet">
                    <i class="ri-delete-bin-line"></i>
                </button>
                ${chipHTML}
                <div class="card-label">Saldo Aktif</div>
                <div class="card-balance">${this.displayMoney(w.balance)}</div>
                
                <div class="card-footer">
                    <div>
                        <div class="card-name">${w.name}</div>
                    </div>
                    <div class="text-right">
                        <div class="card-account">${w.account ? w.account : '----'}</div>
                    </div>
                </div>
            </div>
            `;
        }).join('') : '<div class="text-center text-muted" style="padding:40px 0;">Belum ada dompet di kategori ini.</div>';

        document.getElementById('category-wallets-list').innerHTML = walletListHTML;
    }
    
    renderAssets() {
        // Management Wallets (Custom)
        const mainW = db.data.wallets.filter(w => !['debt', 'receivable'].includes(w.type));
        const walletListHTML = mainW.length > 0 ? mainW.map(w => `
            <div class="list-item-card" style="padding: 12px; margin-bottom: 8px;">
                <div class="asset-icon ${w.theme}" style="background-color: var(--${w.theme.split('-')[1]}-light); color: var(--${w.theme.split('-')[1]}); width: 40px; height: 40px; font-size: 20px;">
                    <i class="${w.icon}"></i>
                </div>
                <div class="list-item-content">
                    <div class="list-item-title" style="font-size: 14px;">${w.name}</div>
                    <div class="list-item-subtitle" style="font-size: 10px; text-transform: uppercase;">${w.type}</div>
                </div>
                <div class="list-item-value">
                    <div class="list-item-amount" style="font-size: 14px;">${this.displayMoney(w.balance)}</div>
                </div>
            </div>
        `).join('') : '<div class="text-center text-muted">Belum ada dompet.</div>';

        document.getElementById('manage-wallets-list').innerHTML = walletListHTML;

        // Actual Assets
        const listHTML = db.data.assets.map(a => `
            <div class="list-item-card">
                <div class="asset-icon ${a.theme}" style="background-color: var(--${a.theme.split('-')[1]}-light); color: var(--${a.theme.split('-')[1]}); width: 48px; height: 48px; font-size: 24px;">
                    <i class="${a.icon}"></i>
                </div>
                <div class="list-item-content">
                    <div class="list-item-title">${a.name}</div>
                    <div class="list-item-subtitle">${db.formatNumber(a.unit, 4)} ${a.unitLabel}</div>
                </div>
                <div class="list-item-value">
                    <div class="list-item-amount">${this.displayMoney(a.unit * a.price)}</div>
                </div>
            </div>
        `).join('');
        document.getElementById('portfolio-list').innerHTML = listHTML;
    }

    renderReport() {
        const stats = db.getMonthlyStats();

        // Budget
        const budgetTarget = db.data.budget.target;
        const spent = stats.expense;
        let p = (spent / budgetTarget) * 100;
        if (p > 100) p = 100;

        document.getElementById('budget-spent-amount').innerText = this.displayMoney(spent);
        document.getElementById('budget-limit-amount').innerText = db.formatCurrency(budgetTarget);

        const pb = document.getElementById('budget-progress');
        pb.style.width = p + '%';

        const stText = document.getElementById('budget-status-text');
        const stPercent = document.getElementById('budget-percent');
        stPercent.innerText = Math.round(p) + '%';

        if (p >= 100) {
            pb.style.backgroundColor = 'var(--danger)';
            stText.className = 'status-text text-red';
            stText.innerText = 'Overbudget! Kurangi pengeluaran.';
            stPercent.className = 'status-percent bg-red text-white badge';
        } else if (p > 80) {
            pb.style.backgroundColor = 'var(--warning)';
            stText.className = 'status-text text-warning';
            stText.innerText = 'Hati-hati, sudah mendekati batas.';
            stPercent.className = 'status-percent badge light bg-warning text-white';
        } else {
            pb.style.backgroundColor = 'var(--primary)';
            stText.className = 'status-text text-muted';
            stText.innerText = 'Pengeluaran aman dan terkendali.';
            stPercent.className = 'status-percent badge light';
        }

        // Cashflow Summary
        document.getElementById('cash-in-amount').innerText = this.displayMoney(stats.income);
        document.getElementById('cash-out-amount').innerText = this.displayMoney(stats.expense);

        // Simple Chart Visualization
        let maxVal = Math.max(stats.income, stats.expense);
        if (maxVal === 0) maxVal = 1; // avoid divide by zero

        document.getElementById('chart-bar-in').style.height = `${(stats.income / maxVal) * 100}%`;
        document.getElementById('chart-bar-out').style.height = `${(stats.expense / maxVal) * 100}%`;

        // Render Pie Chart (Conic gradient)
        this.renderExpensePie(stats.categories);
    }

    renderExpensePie(categories) {
        const colors = ['#4361ee', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b', '#ec4899'];
        let total = Object.values(categories).reduce((sum, val) => sum + val, 0);

        const pieContainer = document.getElementById('expense-pie-chart');
        const legendContainer = document.getElementById('expense-pie-legend');

        if (total === 0) {
            pieContainer.style.background = 'var(--border)';
            legendContainer.innerHTML = '<div class="text-center text-muted">Belum ada pengeluaran</div>';
            return;
        }

        let gradients = [];
        let legendHTML = '';
        let startAngle = 0;
        let colorIdx = 0;

        // Sort categories by amount desc
        const sortedCats = Object.entries(categories).sort((a, b) => b[1] - a[1]);

        for (const [catName, amount] of sortedCats) {
            const percentage = (amount / total) * 100;
            const endAngle = startAngle + percentage;
            const color = colors[colorIdx % colors.length];

            gradients.push(`${color} ${startAngle}% ${endAngle}%`);

            legendHTML += `
                <div class="pie-legend-item">
                    <span class="dot" style="background-color: ${color}"></span> 
                    <span style="flex:1">${catName}</span>
                    <span class="font-weight-bold">${Math.round(percentage)}%</span>
                </div>
            `;

            startAngle = endAngle;
            colorIdx++;
        }

        pieContainer.style.background = `conic-gradient(${gradients.join(', ')})`;
        legendContainer.innerHTML = legendHTML;
    }

    renderHistory() {
        const thtml = db.data.transactions.map(tx => this.generateTxHTML(tx)).join('');
        document.getElementById('all-transactions').innerHTML = thtml || '<div class="text-center text-muted pt-5">Belum ada transaksi</div>';
    }

    generateTxHTML(tx) {
        const isExp = tx.type === 'expense';
        const sign = isExp ? '- ' : '+ ';
        const tColor = isExp ? 'var(--dark)' : 'var(--success)';
        const iconClasses = {
            'expense': 'ri-receipt-line',
            'income': 'ri-hand-coin-line',
            'transfer': 'ri-arrow-left-right-line'
        };

        const wallet = db.data.wallets.find(w => w.id === tx.walletId);
        const walletName = wallet ? wallet.name : 'Unknown';

        // Format Date
        const dateObj = new Date(tx.date);
        const dateStr = `${dateObj.getDate()}/${dateObj.getMonth() + 1}/${dateObj.getFullYear()}`;

        return `
            <div class="tx-item">
                <div class="tx-icon"><i class="${iconClasses[tx.type] || 'ri-file-list-3-line'}"></i></div>
                <div class="tx-details">
                    <div class="tx-title">${tx.note}</div>
                    <div class="tx-meta">${dateStr} • ${walletName.toUpperCase()}</div>
                </div>
                <div class="tx-amount" style="color: ${tColor}">${sign}${this.displayMoney(tx.amount)}</div>
            </div>
        `;
    }
}

// Start App
const app = new AppController();
window.app = app; // Expose globally for inline HTML event handlers
