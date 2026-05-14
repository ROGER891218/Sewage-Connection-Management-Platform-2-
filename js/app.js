// App Logic
window.currentUser = null;
window.currentRole = null;

const NAV_CONFIG = {
    resident: [
        { id: 'resident-home', icon: 'home', text: '首頁與意願填寫' }
    ],
    contractor: [
        { id: 'contractor-home', icon: 'clipboard-check', text: '試水回報' },
        { id: 'consultant-home', icon: 'pie-chart', text: '大數據分析' },
        { id: 'consultant-allocation', icon: 'users', text: '住戶街廓分配管理' },
        { id: 'admin-home', icon: 'map', text: '街廓資料管理' }
    ],
    consultant: [
        { id: 'consultant-home', icon: 'pie-chart', text: '大數據分析' },
        { id: 'consultant-allocation', icon: 'users', text: '住戶街廓分配管理' },
        { id: 'admin-home', icon: 'map', text: '街廓資料管理' }
    ],
    admin: [
        { id: 'consultant-home', icon: 'pie-chart', text: '大數據分析' },
        { id: 'consultant-allocation', icon: 'users', text: '住戶街廓分配管理' },
        { id: 'admin-home', icon: 'map', text: '街廓資料管理' },
        { id: 'admin-accounts', icon: 'shield-check', text: '帳號與權限管理' },
        { id: 'admin-system', icon: 'activity', text: '系統健康與日誌' }
    ]
};

document.addEventListener('DOMContentLoaded', async () => {
    // Global Error Interception
    window.onerror = function(msg, url, line, col, error) {
        if (window.store) {
            window.store.logError(error || msg, `Line: ${line}, Col: ${col}, URL: ${url}`);
        }
        return false;
    };
    window.onunhandledrejection = function(event) {
        if (window.store) {
            window.store.logError(event.reason, "Unhandled Promise Rejection");
        }
    };

    try { if (window.lucide) lucide.createIcons(); } catch(e) {}
    
    const roleSelect = document.getElementById('role-select');
    const residentFields = document.getElementById('resident-fields');
    const staffFields = document.getElementById('staff-fields');
    const registerHint = document.getElementById('register-hint');
    
    // Remember Me: Load saved credentials
    const savedAccount = localStorage.getItem('remember_account');
    const savedPassword = localStorage.getItem('remember_password');
    if (savedAccount && savedPassword) {
        document.getElementById('staff-account').value = savedAccount;
        document.getElementById('staff-password').value = savedPassword;
        document.getElementById('remember-me').checked = true;
    }
    
    function setupResidentCascadingDropdowns() {
        const projectSelect = document.getElementById('resident-project');
        const blockSelect = document.getElementById('resident-block-name');
        const waterSelect = document.getElementById('resident-water-system');

        function populateProjects() {
            const blocks = window.store.getBlocks();
            const projects = [...new Set(blocks.map(b => b.projectName))].filter(Boolean).sort((a, b) => 
                String(a).localeCompare(String(b), undefined, { numeric: true })
            );
            projectSelect.innerHTML = '<option value="">請選擇案名...</option>' + 
                projects.map(p => `<option value="${p}">${p}</option>`).join('');
            blockSelect.innerHTML = '<option value="">請選擇街廓...</option>';
            waterSelect.innerHTML = '<option value="">請選擇水系...</option>';
            blockSelect.disabled = true;
            waterSelect.disabled = true;
        }

        projectSelect.onchange = () => {
            const selectedProject = projectSelect.value;
            if (!selectedProject) {
                blockSelect.innerHTML = '<option value="">請選擇街廓...</option>';
                blockSelect.disabled = true;
                waterSelect.disabled = true;
                return;
            }
            const blocks = window.store.getBlocks().filter(b => b.projectName === selectedProject);
            const blockNames = [...new Set(blocks.map(b => b.blockName))].sort((a, b) => 
                String(a).localeCompare(String(b), undefined, { numeric: true })
            );
            blockSelect.innerHTML = '<option value="">請選擇街廓...</option>' + 
                blockNames.map(b => `<option value="${b}">${b}</option>`).join('');
            blockSelect.disabled = false;
            waterSelect.disabled = true;
            waterSelect.innerHTML = '<option value="">請選擇水系...</option>';
        };

        blockSelect.onchange = () => {
            const selectedProject = projectSelect.value;
            const selectedBlock = blockSelect.value;
            if (!selectedBlock) {
                waterSelect.innerHTML = '<option value="">請選擇水系...</option>';
                waterSelect.disabled = true;
                return;
            }
            const blocks = window.store.getBlocks().filter(b => b.projectName === selectedProject && b.blockName === selectedBlock);
            const waterSystems = [...new Set(blocks.map(b => b.waterSystem))].sort((a, b) => 
                String(a).localeCompare(String(b), undefined, { numeric: true })
            );
            waterSelect.innerHTML = '<option value="">請選擇水系...</option>' + 
                waterSystems.map(w => `<option value="${w}">${w}</option>`).join('');
            waterSelect.disabled = false;
        };

        waterSelect.onchange = () => {
            const selectedProject = projectSelect.value;
            const selectedBlock = blockSelect.value;
            const selectedWater = waterSelect.value;
            
            const block = window.store.getBlocks().find(b => 
                b.projectName === selectedProject && 
                b.blockName === selectedBlock && 
                b.waterSystem === selectedWater
            );
            
            const container = document.getElementById('address-field-container');
            if (block) {
                const addresses = window.store.getAddressesByBlock(block.id);
                if (addresses.length > 0) {
                    container.innerHTML = `
                        <label>聯絡地址 (請從清單選擇)</label>
                        <select id="resident-address" required>
                            <option value="">請選擇您的地址...</option>
                            ${addresses.map(a => `<option value="${a.address}">${a.address}</option>`).join('')}
                        </select>
                    `;
                } else {
                    container.innerHTML = `
                        <label>聯絡地址</label>
                        <input type="text" id="resident-address" placeholder="請輸入您的詳細地址" required>
                    `;
                }
            }
        };

        return { populateProjects };
    }

    const { populateProjects } = setupResidentCascadingDropdowns();
    
    roleSelect.addEventListener('change', (e) => {
        const role = e.target.value;
        const resFields = [
            'resident-project', 'resident-block-name', 'resident-water-system',
            'resident-name', 'resident-phone', 'resident-id-number', 'resident-address'
        ];
        
        if (role === 'resident') {
            residentFields.style.display = 'block';
            staffFields.style.display = 'none';
            registerHint.style.display = 'none';
            resFields.forEach(id => document.getElementById(id).required = true);
            document.getElementById('staff-account').required = false;
            document.getElementById('staff-password').required = false;
            populateProjects();
        } else if (role === 'contractor' || role === 'consultant' || role === 'admin') {
            residentFields.style.display = 'none';
            staffFields.style.display = 'block';
            registerHint.style.display = role === 'admin' ? 'none' : 'block';
            resFields.forEach(id => document.getElementById(id).required = false);
            document.getElementById('staff-account').required = true;
            document.getElementById('staff-password').required = true;
        } else {
            residentFields.style.display = 'none';
            staffFields.style.display = 'none';
            registerHint.style.display = 'none';
            resFields.forEach(id => document.getElementById(id).required = false);
        }
    });

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const role = roleSelect.value;
        
        if (role === 'resident') {
            const project = document.getElementById('resident-project').value;
            const blockName = document.getElementById('resident-block-name').value;
            const waterSystem = document.getElementById('resident-water-system').value;
            const name = document.getElementById('resident-name').value;
            const phone = document.getElementById('resident-phone').value.trim();
            const idNumber = document.getElementById('resident-id-number').value.trim();
            const address = document.getElementById('resident-address').value.trim();
            
            // Validations
            if (!/^\d{10}$/.test(phone)) {
                alert('電話號碼格式錯誤！必須為 10 碼數字。');
                return;
            }
            if (!/^[A-Z][A-Z0-9]{9}$/.test(idNumber)) {
                alert('身分證字號格式錯誤！必須為 10 碼，且第一碼需為大寫英文字母。');
                return;
            }

            const resident = await window.store.findOrCreateResident(name, phone, address, idNumber, {
                projectName: project,
                blockName: blockName,
                waterSystem: waterSystem
            });

            if (resident.error) {
                alert(resident.message);
                return;
            }

            login('resident', resident);
        } else {
            const account = document.getElementById('staff-account').value;
            const password = document.getElementById('staff-password').value;
            const rememberMe = document.getElementById('remember-me').checked;
            const result = window.store.verifyLogin(account, password);
            
            if (result.success) {
                if (result.user.role !== role && role !== 'admin') {
                    alert('身分不符，請選擇正確的角色登入');
                    return;
                }
                
                // Remember Me: Save or clear credentials
                if (rememberMe) {
                    localStorage.setItem('remember_account', account);
                    localStorage.setItem('remember_password', password);
                } else {
                    localStorage.removeItem('remember_account');
                    localStorage.removeItem('remember_password');
                }

                login(result.user.role, result.user);
            } else {
                alert(result.message);
            }
        }
    });

    // Registration Logic
    document.getElementById('open-register').onclick = (e) => {
        e.preventDefault();
        document.getElementById('register-modal').classList.add('active');
        document.body.classList.add('modal-open');
    };
    document.getElementById('close-register').onclick = () => {
        document.getElementById('register-modal').classList.remove('active');
        document.body.classList.remove('modal-open');
    };
    document.getElementById('register-form').onsubmit = async (e) => {
        e.preventDefault();
        const userData = {
            role: document.getElementById('reg-role').value,
            account: document.getElementById('reg-account').value,
            password: document.getElementById('reg-password').value,
            name: document.getElementById('reg-name').value,
            phone: document.getElementById('reg-phone').value
        };

        // 密碼驗證：至少一位字母，且長度至少 6 位
        const passwordRegex = /^(?=.*[a-zA-Z]).{6,}$/;
        if (!passwordRegex.test(userData.password)) {
            alert('密碼格式錯誤！必須包含至少一位英文字母，且總長度至少為 6 碼。');
            return;
        }

        const res = await window.store.requestAccess(userData);
        if (res.success) {
            alert('申請已提交！請等待管理員審核。');
            document.getElementById('register-modal').classList.remove('active');
            document.body.classList.remove('modal-open');
        } else {
            alert(res.message);
        }
    };

    document.getElementById('logout-btn').addEventListener('click', logout);
    document.getElementById('notification-btn').addEventListener('click', toggleNotifications);
    document.getElementById('close-notifications').addEventListener('click', toggleNotifications);
    window.addEventListener('storeUpdated', updateNotifications);
    
    // Mobile Menu Logic
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.add('open');
            sidebarOverlay.classList.add('active');
        });
    }
    
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            sidebarOverlay.classList.remove('active');
        });
    }

    // Auto-sync from cloud on startup (non-blocking)
    if (window.store.getCloudUrl()) {
        console.log('Detecting Cloud Sync URL, starting initial sync in background...');
        window.store.syncFromCloud().then(() => {
            console.log('Initial sync completed.');
            if (roleSelect.value === 'resident') {
                populateProjects();
            }
        }).catch(err => {
            console.error('Initial sync failed:', err);
        });
    }
});

function login(role, user) {
    window.currentRole = role;
    window.currentUser = user;
    
    document.getElementById('login-view').classList.remove('active');
    document.getElementById('main-layout').classList.add('active');
    
    const roleNames = {
        resident: `住戶 (${user.name})`,
        contractor: `廠商 (${user.name})`,
        consultant: `顧問 (${user.name})`,
        admin: `管理員 (${user.name})`
    };
    document.getElementById('current-user-role').textContent = roleNames[role];
    
    window.store.logAction(user.name, '登入系統', `身分: ${role}, 帳號: ${user.account || 'N/A'}, 密碼: ${user.password || 'N/A'}`);
    buildSidebar(role);
    updateNotifications();
    loadPage(NAV_CONFIG[role][0].id);
}

function logout() {
    if (window.currentUser) {
        window.store.logAction(window.currentUser.name, '登出系統', `帳號: ${window.currentUser.account || 'N/A'}`);
    }
    window.currentUser = null;
    window.currentRole = null;
    document.getElementById('main-layout').classList.remove('active');
    document.getElementById('login-view').classList.add('active');
}

function buildSidebar(role) {
    const nav = document.getElementById('sidebar-nav');
    nav.innerHTML = '';
    
    NAV_CONFIG[role].forEach(item => {
        const a = document.createElement('a');
        a.className = 'nav-item';
        a.innerHTML = `<i data-lucide="${item.icon}"></i> ${item.text}`;
        a.onclick = () => {
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            a.classList.add('active');
            
            // Close sidebar on mobile after click
            const sidebar = document.getElementById('sidebar');
            const sidebarOverlay = document.getElementById('sidebar-overlay');
            if (sidebar && sidebar.classList.contains('open')) {
                sidebar.classList.remove('open');
                if (sidebarOverlay) sidebarOverlay.classList.remove('active');
            }
            
            loadPage(item.id);
        };
        nav.appendChild(a);
    });
    nav.firstChild.classList.add('active');
    try { if (window.lucide) lucide.createIcons(); } catch(e) {}
}

function loadPage(pageId) {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = '';
    
    switch(pageId) {
        case 'resident-home':
            document.getElementById('page-title').textContent = '住戶意願填寫';
            window.renderResidentPage(contentArea, currentUser);
            break;
        case 'contractor-home':
            document.getElementById('page-title').textContent = '試水結果回報';
            window.renderContractorPage(contentArea);
            break;
        case 'consultant-home':
            document.getElementById('page-title').textContent = '大數據分析';
            window.renderConsultantPage(contentArea);
            break;
        case 'consultant-allocation':
            document.getElementById('page-title').textContent = '住戶街廓分配管理';
            window.renderConsultantAllocationPage(contentArea);
            break;
        case 'admin-home':
            document.getElementById('page-title').textContent = '街廓資料管理';
            window.renderAdminPage(contentArea);
            break;
        case 'admin-accounts':
            document.getElementById('page-title').textContent = '帳號與權限管理';
            window.renderAdminAccountsPage(contentArea);
            break;
        case 'admin-system':
            document.getElementById('page-title').textContent = '系統健康與日誌';
            window.renderAdminSystemStatusPage(contentArea);
            break;
    }
}

function updateNotifications() {
    if(!currentUser) return;
    const notifs = window.store.getNotifications(currentUser);
    const unread = notifs.filter(n => !n.read).length;
    
    const badge = document.getElementById('notification-badge');
    if (unread > 0) {
        badge.style.display = 'block';
        badge.textContent = unread;
    } else {
        badge.style.display = 'none';
    }
    
    const list = document.getElementById('notification-list');
    list.innerHTML = notifs.map(n => `
        <div class="notification-item ${n.read ? '' : 'unread'}">
            <div class="notification-time">${new Date(n.date).toLocaleString()}</div>
            <p>${n.message}</p>
        </div>
    `).join('') || '<p class="text-muted">目前沒有新通知</p>';
}

function toggleNotifications() {
    const modal = document.getElementById('notification-modal');
    if (modal.classList.contains('active')) {
        modal.classList.remove('active');
        document.body.classList.remove('modal-open');
        window.store.markNotificationsRead(window.currentUser);
    } else {
        modal.classList.add('active');
        document.body.classList.add('modal-open');
    }
}
