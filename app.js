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
        this.walletTabBtns = document.querySelectorAll('.wallet-tab-btn');
        this.currentTxType = 'expense';
        this.currentWalletCategory = 'ewallet';
        
        // Debt
        this.modalAddDebt = document.getElementById('add-debt-modal');
        this.formDebt = document.getElementById('form-add-debt');
        const debtProof = document.getElementById('debt-proof');
        if(debtProof) {
            debtProof.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if(file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const img = document.getElementById('debt-proof-preview');
                        img.src = e.target.result;
                        img.style.display = 'block';
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
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
            'history': 'Riwayat',
            'wallet-category': 'Kategori Dompet'
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
        if(this.modalAddDebt) this.modalAddDebt.classList.remove('active');

        if (this.formTx) this.formTx.reset();
        if (this.formWallet) this.formWallet.reset();
        if (this.formDebt) {
            this.formDebt.reset();
            const preview = document.getElementById('debt-proof-preview');
            if(preview) {
                preview.src = '';
                preview.style.display = 'none';
            }
        }
        document.getElementById('tx-date').valueAsDate = new Date();
    }

    handleWalletSubmit() {
        const name = document.getElementById('wallet-name').value;
        const type = document.getElementById('wallet-type').value;
        const balance = document.getElementById('wallet-balance').value;
        const account = document.getElementById('wallet-account').value;

        if (!name) return alert('Nama dompet harus diisi!');

        db.addWallet(name, type, balance, account);

        this.closeModals();
        
        this.render(); // Re-render to show new wallet
        
        // If we are currently in wallet-category view, re-render it
        if(this.currentView === 'wallet-category') {
             this.renderCategoryWallets();
        }

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

    openDebtModal() {
        this.openModal(this.modalAddDebt);
    }

    async handleDebtSubmit() {
        const type = document.getElementById('debt-type').value;
        const name = document.getElementById('debt-name').value;
        const phone = document.getElementById('debt-phone').value;
        const amount = document.getElementById('debt-amount').value;
        const proofImgSrc = document.getElementById('debt-proof-preview').src;

        if (!name) return alert('Nama tujuan harus diisi!');
        if (!amount || amount <= 0) return alert('Masukkan nominal yang valid!');

        // Determine if valid base64 image or just current pagelink (empty)
        const finalImage = proofImgSrc.startsWith('data:image') ? proofImgSrc : '';

        db.addDebt(type, name, phone, amount, finalImage);

        this.closeModals();
        this.render(); // Re-render to update
    }

    resolveDebt(id) {
        if(confirm('Apakah Anda yakin menandai catatan ini sebagai Selesai / Lunas?')) {
            db.resolveDebt(id);
            this.render();
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

        // Wallets (Accumulated by Category)
        const categories = [
            { id: 'ewallet', name: 'E-Wallet', theme: 'theme-purple', icon: 'ri-smartphone-line' },
            { id: 'bank', name: 'Rekening', theme: 'theme-blue', icon: 'ri-bank-card-line' },
            { id: 'cash', name: 'Tunai', theme: 'theme-green', icon: 'ri-money-dollar-circle-line' }
        ];

        const mainWalletsHTML = categories.map(cat => {
            const wallets = db.data.wallets.filter(w => w.type === cat.id);
            if (wallets.length === 0) return ''; // Hide category if empty
            const sum = wallets.reduce((acc, curr) => acc + curr.balance, 0);
            return `
            <div class="wallet-card ${cat.theme}">
                <div class="wallet-icon"><i class="${cat.icon}"></i></div>
                <div class="wallet-info mt-2">
                    <span class="label">${cat.name}</span>
                    <span class="amount">${this.displayMoney(sum)}</span>
                </div>
            </div>
            `;
        }).join('');
        document.getElementById('wallets-grid-main').innerHTML = mainWalletsHTML;

        const secondaryWalletsHTML = db.data.wallets.filter(w => ['debt', 'receivable'].includes(w.type)).map(w => `
            <div class="wallet-card ${w.theme}">
                <div class="wallet-icon"><i class="${w.icon}"></i></div>
                <div class="wallet-info mt-2">
                    <span class="label">${w.name}</span>
                    <span class="amount">${this.displayMoney(w.balance)}</span>
                </div>
            </div>
        `).join('');
        document.getElementById('wallets-grid-secondary').innerHTML = secondaryWalletsHTML;

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

    openCategoryView(categoryId, categoryName) {
        this.currentWalletCategory = categoryId;
        document.getElementById('category-title').innerText = categoryName;
        this.navigate('wallet-category');
        this.renderCategoryWallets();
    }

    openCategoryAdd() {
        document.getElementById('wallet-type').value = this.currentWalletCategory;
        this.openModal(this.modalAddWallet);
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
        // Management Wallets Menu
        const categories = [
            { id: 'ewallet', name: 'E-Wallet', theme: 'theme-purple', icon: 'ri-smartphone-line' },
            { id: 'bank', name: 'Rekening Bank', theme: 'theme-blue', icon: 'ri-bank-card-line' },
            { id: 'cash', name: 'Uang Tunai', theme: 'theme-green', icon: 'ri-money-dollar-circle-line' }
        ];

        const menuHTML = categories.map(cat => {
            const wallets = db.data.wallets.filter(w => w.type === cat.id);
            const sum = wallets.reduce((acc, curr) => acc + curr.balance, 0);
            
            return `
            <div class="list-item-card" style="padding: 16px; margin-bottom: 12px; cursor: pointer;" onclick="app.openCategoryView('${cat.id}', '${cat.name}')">
                <div class="asset-icon ${cat.theme}" style="background-color: var(--${cat.theme.split('-')[1]}-light); color: var(--${cat.theme.split('-')[1]}); width: 48px; height: 48px; font-size: 24px;">
                    <i class="${cat.icon}"></i>
                </div>
                <div class="list-item-content">
                    <div class="list-item-title" style="font-size: 16px;">${cat.name}</div>
                    <div class="list-item-subtitle" style="font-size: 11px;">${wallets.length} Dompet</div>
                </div>
                <div class="list-item-value">
                    <div class="list-item-amount" style="font-size: 15px;">${this.displayMoney(sum)}</div>
                    <div style="font-size: 10px; color: var(--text-muted); text-align: right; margin-top:4px;">Lihat Detail <i class="ri-arrow-right-s-line"></i></div>
                </div>
            </div>
            `;
        }).join('');

        document.getElementById('manage-wallets-list').innerHTML = menuHTML;

        // Debt Management
        const debtsHTML = db.data.debts.map(d => {
            const isHutang = d.type === 'hutang';
            const iconClass = isHutang ? 'ri-arrow-down-circle-line text-red' : 'ri-arrow-up-circle-line text-green';
            const typeText = isHutang ? 'Hutang' : 'Piutang';
            const phoneStr = d.phone ? d.phone.replace(/[^0-9]/g, '') : '';
            const phoneLink = phoneStr ? `<a href="https://wa.me/${phoneStr.startsWith('0') ? '62' + phoneStr.substring(1) : phoneStr}" target="_blank" class="btn btn-small btn-outline mt-2" style="display:inline-flex; align-items:center; gap:4px; padding:6px 10px; font-size:11px;"><i class="ri-whatsapp-line text-green" style="font-size:14px;"></i> Chat WA</a>` : '';
            const proofHTML = d.proofImage ? `<div class="mt-2 text-blue" style="font-size:11px; cursor:pointer;" onclick="window.open('${d.proofImage}', '_blank')"><i class="ri-image-line"></i> Lihat Bukti</div>` : '';

            return `
            <div class="list-item-card" style="flex-direction: column; align-items: flex-start;">
                <div style="display:flex; width:100%; justify-content:space-between; align-items:flex-start;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <i class="${iconClass}" style="font-size:24px;"></i>
                        <div>
                            <div class="list-item-title">${d.name}</div>
                            <div class="list-item-subtitle">${typeText} • ${new Date(d.date).toLocaleDateString('id-ID')}</div>
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <div class="list-item-amount ${isHutang ? 'text-red' : 'text-green'}">${this.displayMoney(d.amount)}</div>
                        <button class="btn btn-small mt-1" style="background:var(--success-light); color:var(--success); padding:4px 8px;" onclick="app.resolveDebt('${d.id}')"><i class="ri-check-line"></i> Lunas</button>
                    </div>
                </div>
                <div style="display:flex; gap:12px;">
                    ${phoneLink}
                    ${proofHTML}
                </div>
            </div>
            `;
        }).join('');

        const debtListEl = document.getElementById('debt-list');
        if(debtListEl) {
            debtListEl.innerHTML = debtsHTML || '<div class="text-center text-muted" style="padding:20px 0;">Belum ada catatan hutang/piutang aktif.</div>';
        }

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
