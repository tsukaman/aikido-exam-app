class AikidoExamApp {
    constructor() {
        this.data = null;
        this.currentExamData = null;
        this.speechSynthesis = window.speechSynthesis;
        this.currentUtterance = null;
        this.isLoading = false;
        this.currentMode = 'search'; // 'search', 'exam', 'admin'
        this.allTechniques = []; // 全技術データを格納
        this.isAuthenticated = false;
        this.userInfo = null;
        this.currentEditingTechnique = null;
        this.allTags = new Set(); // 全タグを格納
        this.auth0 = null; // Auth0インスタンス
        this.sequentialReading = {
            isActive: false,
            currentIndex: 0,
            techniqueIds: [],
            timeoutId: null
        }; // 順次読み上げ用の状態
        
        // Auth0設定
        this.auth0Config = {
            domain: 'dev-qsdnauzbgus8v8wr.jp.auth0.com', // 例: 'dev-example.us.auth0.com'
            clientId: 'yB2AU17MwX7gm7mBr62yUskD3eZvPYgP',
            authorizationParams: {
                redirect_uri: window.location.origin + window.location.pathname
            }
        };
        
        this.init();
    }

    async init() {
        try {
            // まずAuth0を初期化
            await this.initializeAuth0();
            
            // ログイン状態をチェック
            const isAuthenticated = await this.checkAuthenticationRequired();
            
            if (isAuthenticated) {
                // 認証済みの場合のみアプリを初期化
                await this.loadData();
                this.extractAllTechniques();
                this.extractAllTags();
                this.setupEventListeners();
                this.populateExamCategories();
                this.setupModeSwitch();
                this.showMainApp();
            } else {
                // 未認証の場合は必ずログイン画面を表示
                this.showLoginScreen();
            }
        } catch (error) {
            console.error('初期化エラー:', error);
            // エラーの場合でもログイン画面を表示
            this.showLoginScreen();
            this.showError('アプリケーションの初期化に失敗しました。認証が必要です。');
        }
    }

    async loadData() {
        try {
            const response = await fetch('./data/aikido-ryu-exam-db.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.data = await response.json();
        } catch (error) {
            console.error('データ読み込みエラー:', error);
            throw new Error('審査データの読み込みに失敗しました。');
        }
    }

    extractAllTechniques() {
        this.allTechniques = [];
        
        // 基本動作を追加
        if (this.data.技術データベース.基本動作) {
            this.allTechniques.push(...this.data.技術データベース.基本動作);
        }
        
        // 技法を追加
        if (this.data.技術データベース.技法) {
            this.allTechniques.push(...this.data.技術データベース.技法);
        }
        
        console.log(`総技術数: ${this.allTechniques.length}`);
    }

    extractAllTags() {
        this.allTags.clear();
        
        this.allTechniques.forEach(technique => {
            if (technique.カテゴリ && Array.isArray(technique.カテゴリ)) {
                technique.カテゴリ.forEach(tag => {
                    this.allTags.add(tag);
                });
            }
            if (technique.攻撃) {
                this.allTags.add(technique.攻撃);
            }
        });
        
        console.log(`総タグ数: ${this.allTags.size}`);
    }

    async initializeAuth0() {
        try {
            // Auth0の初期化
            if (typeof auth0 !== 'undefined') {
                this.auth0 = await auth0.createAuth0Client(this.auth0Config);
                
                // サインインボタンの設定
                const signInBtn = document.getElementById('auth0-signin-btn');
                if (signInBtn) {
                    signInBtn.addEventListener('click', () => {
                        this.login();
                    });
                }
            } else {
                console.warn('Auth0ライブラリが読み込まれていません');
                // Auth0が利用できない場合はアプリを利用不可にする
                this.showError('認証システムが利用できません。');
                throw new Error('Auth0ライブラリが読み込まれていません');
            }
        } catch (error) {
            console.error('Auth0初期化エラー:', error);
            throw error;
        }
    }

    async checkAuthenticationRequired() {
        try {
            // URLにコールバックが含まれている場合の処理
            if (window.location.search.includes('code=') || window.location.search.includes('error=')) {
                await this.auth0.handleRedirectCallback();
                window.history.replaceState({}, document.title, window.location.pathname);
            }

            // ログイン状態をチェック
            const isAuthenticated = await this.auth0.isAuthenticated();
            if (isAuthenticated) {
                const user = await this.auth0.getUser();
                
                // ユーザーがブロックされていないかチェック
                if (user.blocked) {
                    await this.logout();
                    this.showError('アカウントが無効化されています。管理者にお問い合わせください。');
                    return false;
                }
                
                // カスタム属性での承認状態チェック（現在は無効化）
                // const userApproved = user['https://aikido-app.com/approved'] || false;
                // if (!userApproved) {
                //     await this.logout();
                //     this.showApprovalPendingMessage();
                //     return false;
                // }
                
                this.userInfo = {
                    email: user.email,
                    name: user.name || user.nickname,
                    picture: user.picture,
                    blocked: user.blocked || false
                };
                this.isAuthenticated = true;
                this.updateAuthUI();
                return true;
            }
            return false;
        } catch (error) {
            console.error('認証状態チェックエラー:', error);
            return false;
        }
    }

    async checkAuthStatus() {
        // 後方互換性のため残す
        return await this.checkAuthenticationRequired();
    }

    async login() {
        try {
            await this.auth0.loginWithRedirect();
        } catch (error) {
            console.error('ログインエラー:', error);
            this.showError('ログインに失敗しました。');
        }
    }

    updateAuthUI() {
        const signInBtn = document.getElementById('auth0-signin-btn');
        const userInfo = document.getElementById('user-info');
        const userName = document.getElementById('user-name');
        const adminModeTab = document.getElementById('admin-mode-tab');
        
        if (this.isAuthenticated) {
            signInBtn.style.display = 'none';
            userInfo.style.display = 'flex';
            userName.textContent = this.userInfo.name;
            adminModeTab.style.display = 'block';
        } else {
            signInBtn.style.display = 'block';
            userInfo.style.display = 'none';
            adminModeTab.style.display = 'none';
        }
    }

    showLoginScreen() {
        // メインコンテンツを非表示
        document.querySelector('main').style.display = 'none';
        
        // タブコンテナを非表示
        document.querySelector('.mode-tabs').style.display = 'none';
        
        // ログインボタンのみ表示
        document.getElementById('auth0-signin-btn').style.display = 'block';
        document.getElementById('user-info').style.display = 'none';
        
        // ログイン促進メッセージを表示
        this.showLoginMessage();
    }

    showMainApp() {
        // メインコンテンツを表示
        document.querySelector('main').style.display = 'flex';
        
        // タブコンテナを表示
        document.querySelector('.mode-tabs').style.display = 'flex';
        
        // 全てのタブを表示
        document.querySelectorAll('.tab-button').forEach(tab => {
            tab.style.display = 'block';
        });
        
        // ログインメッセージを非表示
        this.hideLoginMessage();
    }

    showLoginMessage() {
        const loginMessage = document.createElement('div');
        loginMessage.id = 'login-message';
        loginMessage.className = 'login-message';
        loginMessage.innerHTML = `
            <div class="login-content">
                <h2>🥋 合気道審査支援アプリへようこそ</h2>
                <p>このアプリを利用するには、ログインが必要です。</p>
                <p>アカウントをお持ちでない場合は、ログインボタンから新規登録できます。</p>
                <div class="login-features">
                    <h3>✨ 主な機能</h3>
                    <ul>
                        <li>📚 技検索・詳細表示</li>
                        <li>🎯 審査支援・ランダム選択</li>
                        <li>🔊 音声読み上げ機能</li>
                        <li>⚙️ データ管理（管理者）</li>
                    </ul>
                </div>
            </div>
        `;
        
        document.querySelector('.container').appendChild(loginMessage);
    }

    hideLoginMessage() {
        const loginMessage = document.getElementById('login-message');
        if (loginMessage) {
            loginMessage.remove();
        }
    }

    showApprovalPendingMessage() {
        // メインコンテンツを非表示
        document.querySelector('main').style.display = 'none';
        
        // ログイン関連UIを非表示
        document.getElementById('auth0-signin-btn').style.display = 'none';
        document.getElementById('user-info').style.display = 'none';
        
        // 既存のメッセージを削除
        this.hideLoginMessage();
        
        const approvalMessage = document.createElement('div');
        approvalMessage.id = 'approval-message';
        approvalMessage.className = 'approval-message';
        approvalMessage.innerHTML = `
            <div class="approval-content">
                <h2>⏳ 承認待ち</h2>
                <p>アカウントが作成されました。</p>
                <p>管理者による承認をお待ちください。</p>
                <div class="approval-info">
                    <h3>📧 次のステップ</h3>
                    <ul>
                        <li>承認完了後、再度ログインしてご利用ください</li>
                        <li>ご質問がある場合は管理者にお問い合わせください</li>
                    </ul>
                </div>
                <button id="approval-logout-btn" class="btn btn-secondary" style="margin-top: 20px;">
                    ログアウト
                </button>
            </div>
        `;
        
        document.querySelector('.container').appendChild(approvalMessage);
        
        // ログアウトボタンのイベントリスナー
        document.getElementById('approval-logout-btn').addEventListener('click', () => {
            this.forceLogout();
        });
    }

    async forceLogout() {
        try {
            this.isAuthenticated = false;
            this.userInfo = null;
            
            // 承認待ちメッセージを削除
            const approvalMessage = document.getElementById('approval-message');
            if (approvalMessage) {
                approvalMessage.remove();
            }
            
            // ログイン画面を表示
            this.showLoginScreen();
        } catch (error) {
            console.error('強制ログアウトエラー:', error);
        }
    }

    showAdminMode() {
        // 管理者モードに自動切替（認証済みユーザーのみ）
        if (this.isAuthenticated) {
            this.switchMode('admin');
            this.loadAdminTechniques();
            this.loadTagManagement();
        }
    }

    async logout() {
        try {
            if (this.auth0) {
                await this.auth0.logout({
                    logoutParams: {
                        returnTo: window.location.origin + window.location.pathname
                    }
                });
            }
            this.isAuthenticated = false;
            this.userInfo = null;
            this.updateAuthUI();
            this.showLoginScreen(); // ログアウト後はログイン画面を表示
        } catch (error) {
            console.error('ログアウトエラー:', error);
            this.showError('ログアウトに失敗しました。');
        }
    }

    setupModeSwitch() {
        const searchModeTab = document.getElementById('search-mode-tab');
        const examModeTab = document.getElementById('exam-mode-tab');
        const adminModeTab = document.getElementById('admin-mode-tab');
        
        searchModeTab.addEventListener('click', () => {
            this.switchMode('search');
        });
        
        examModeTab.addEventListener('click', () => {
            this.switchMode('exam');
        });
        
        adminModeTab.addEventListener('click', () => {
            if (this.isAuthenticated) {
                this.switchMode('admin');
            } else {
                this.showError('管理者機能にアクセスするにはログインが必要です。');
            }
        });
    }

    switchMode(mode) {
        this.currentMode = mode;
        
        const searchMode = document.getElementById('search-mode');
        const examMode = document.getElementById('exam-mode');
        const adminMode = document.getElementById('admin-mode');
        const searchModeTab = document.getElementById('search-mode-tab');
        const examModeTab = document.getElementById('exam-mode-tab');
        const adminModeTab = document.getElementById('admin-mode-tab');
        
        // すべて非表示
        [searchMode, examMode, adminMode].forEach(el => {
            if (el) el.style.display = 'none';
        });
        
        // すべてのタブを非アクティブ
        [searchModeTab, examModeTab, adminModeTab].forEach(el => {
            if (el) el.classList.remove('active');
        });
        
        // 選択されたモードを表示
        if (mode === 'search') {
            searchMode.style.display = 'block';
            searchModeTab.classList.add('active');
        } else if (mode === 'exam') {
            examMode.style.display = 'block';
            examModeTab.classList.add('active');
        } else if (mode === 'admin' && this.isAuthenticated) {
            adminMode.style.display = 'block';
            adminModeTab.classList.add('active');
            this.setupAdminTabs();
        }
    }

    setupEventListeners() {
        // 審査支援モードのイベントリスナー
        const examCategorySelect = document.getElementById('exam-category');
        const gradeSelect = document.getElementById('grade');
        const showDesignatedBtn = document.getElementById('show-designated-btn');
        const randomSelectBtn = document.getElementById('random-select-btn');
        const randomDesignatedBtn = document.getElementById('random-designated-btn');
        const sequentialReadingBtn = document.getElementById('sequential-reading-btn');
        const stopSpeechBtn = document.getElementById('stop-speech-btn');

        examCategorySelect.addEventListener('change', () => {
            this.onExamCategoryChange();
        });

        gradeSelect.addEventListener('change', () => {
            this.onGradeChange();
        });

        showDesignatedBtn.addEventListener('click', () => {
            this.showDesignatedTechniques();
        });

        randomSelectBtn.addEventListener('click', () => {
            this.selectRandomTechnique();
        });

        randomDesignatedBtn.addEventListener('click', () => {
            this.selectRandomDesignatedTechnique();
        });

        sequentialReadingBtn.addEventListener('click', () => {
            this.startSequentialReading();
        });

        stopSpeechBtn.addEventListener('click', () => {
            this.stopSpeech();
        });

        // 検索モードのイベントリスナー
        const searchBtn = document.getElementById('search-btn');
        const clearSearchBtn = document.getElementById('clear-search-btn');
        const showAllTechniquesBtn = document.getElementById('show-all-techniques-btn');
        const searchText = document.getElementById('search-text');

        searchBtn.addEventListener('click', () => {
            this.performSearch();
        });

        clearSearchBtn.addEventListener('click', () => {
            this.clearSearch();
        });

        showAllTechniquesBtn.addEventListener('click', () => {
            this.showAllTechniquesInSearch();
        });

        // キーワード検索でEnterキー押下時に検索実行
        searchText.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });

        // チェックボックスの変更でリアルタイム検索
        document.querySelectorAll('.category-filter, .attack-filter, .position-filter').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.performSearch();
            });
        });

        // 審査区分フィルター
        const searchExamCategory = document.getElementById('search-exam-category');
        const searchExamGrade = document.getElementById('search-exam-grade');

        if (searchExamCategory) {
            searchExamCategory.addEventListener('change', () => {
                this.updateSearchExamGrades();
                this.performSearch();
            });
        }

        if (searchExamGrade) {
            searchExamGrade.addEventListener('change', () => {
                this.performSearch();
            });
        }

        // 技カードクリック時の処理
        document.addEventListener('click', (e) => {
            if (e.target.closest('.technique-item')) {
                const techniqueItem = e.target.closest('.technique-item');
                
                // 検索モードの場合は詳細表示、審査支援モードの場合は音声読み上げ
                if (this.currentMode === 'search') {
                    // 技IDを取得して詳細表示
                    const techniqueId = techniqueItem.dataset.techniqueId;
                    if (techniqueId) {
                        this.showTechniqueDetail(techniqueId);
                    }
                } else if (this.currentMode === 'exam') {
                    // 審査支援モードでは従来通り音声読み上げ
                    const techniqueName = techniqueItem.querySelector('h3').textContent;
                    const reading = techniqueItem.querySelector('.reading').textContent;
                    this.speakTechnique(techniqueName, reading);
                }
            } else if (e.target.closest('.exam-technique-item')) {
                // 審査支援専用のリスト項目がクリックされた場合
                const examTechniqueItem = e.target.closest('.exam-technique-item');
                const techniqueId = examTechniqueItem.dataset.techniqueId;
                
                if (techniqueId) {
                    // 技IDがある場合は詳細表示
                    this.showTechniqueDetail(techniqueId);
                } else {
                    // 技IDがない場合（指定技や自由技など）は音声読み上げ
                    const techniqueName = examTechniqueItem.querySelector('.exam-technique-name').textContent;
                    const reading = examTechniqueItem.querySelector('.exam-technique-reading').textContent;
                    this.speakTechnique(techniqueName, reading);
                }
            }
        });

        // 認証関連のイベントリスナー
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.logout();
            });
        }

        // 管理者機能のイベントリスナー
        this.setupAdminEventListeners();

        // 表示切替トグルのイベントリスナー
        this.setupViewToggleListeners();

        // モーダル関連のイベントリスナー
        this.setupModalListeners();

        // 音声設定のイベントリスナー
        this.setupSpeechSettingsListeners();
    }

    setupAdminEventListeners() {
        // 技管理
        const addTechniqueBtn = document.getElementById('add-technique-btn');
        const cancelEditBtn = document.getElementById('cancel-edit-btn');
        const deleteTechniqueBtn = document.getElementById('delete-technique-btn');
        const techniqueForm = document.getElementById('technique-form');

        if (addTechniqueBtn) {
            addTechniqueBtn.addEventListener('click', () => {
                this.showTechniqueForm();
            });
        }

        if (cancelEditBtn) {
            cancelEditBtn.addEventListener('click', () => {
                this.hideTechniqueForm();
            });
        }

        if (deleteTechniqueBtn) {
            deleteTechniqueBtn.addEventListener('click', () => {
                this.deleteTechnique();
            });
        }

        if (techniqueForm) {
            techniqueForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveTechnique();
            });
        }

        // タグ管理
        const addTagBtn = document.getElementById('add-tag-btn');
        const newTagInput = document.getElementById('new-tag-input');

        if (addTagBtn) {
            addTagBtn.addEventListener('click', () => {
                this.addNewTag();
            });
        }

        if (newTagInput) {
            newTagInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.addNewTag();
                }
            });
        }

        // データエクスポート・インポート
        const exportFullBtn = document.getElementById('export-full-btn');
        const exportTechniquesBtn = document.getElementById('export-techniques-btn');
        const exportBackupBtn = document.getElementById('export-backup-btn');
        const importBtn = document.getElementById('import-btn');

        if (exportFullBtn) {
            exportFullBtn.addEventListener('click', () => {
                this.exportData('full');
            });
        }

        if (exportTechniquesBtn) {
            exportTechniquesBtn.addEventListener('click', () => {
                this.exportData('techniques');
            });
        }

        if (exportBackupBtn) {
            exportBackupBtn.addEventListener('click', () => {
                this.exportData('backup');
            });
        }

        if (importBtn) {
            importBtn.addEventListener('click', () => {
                this.importData();
            });
        }

        // 管理者フィルター
        const adminFilterBtn = document.getElementById('admin-filter-btn');
        const adminClearFilterBtn = document.getElementById('admin-clear-filter-btn');
        const adminSearchText = document.getElementById('admin-search-text');

        if (adminFilterBtn) {
            adminFilterBtn.addEventListener('click', () => {
                this.applyAdminFilter();
            });
        }

        if (adminClearFilterBtn) {
            adminClearFilterBtn.addEventListener('click', () => {
                this.clearAdminFilter();
            });
        }

        if (adminSearchText) {
            adminSearchText.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.applyAdminFilter();
                }
            });
        }
    }

    setupViewToggleListeners() {
        // 検索モードの表示切替
        const searchCardViewBtn = document.getElementById('search-card-view');
        const searchListViewBtn = document.getElementById('search-list-view');
        
        if (searchCardViewBtn && searchListViewBtn) {
            searchCardViewBtn.addEventListener('click', () => {
                this.toggleSearchView('card');
            });
            
            searchListViewBtn.addEventListener('click', () => {
                this.toggleSearchView('list');
            });
        }

        // 管理者モードの表示切替
        const adminCardViewBtn = document.getElementById('admin-card-view');
        const adminListViewBtn = document.getElementById('admin-list-view');
        
        if (adminCardViewBtn && adminListViewBtn) {
            adminCardViewBtn.addEventListener('click', () => {
                this.toggleAdminView('card');
            });
            
            adminListViewBtn.addEventListener('click', () => {
                this.toggleAdminView('list');
            });
        }
    }

    toggleSearchView(viewType) {
        const cardBtn = document.getElementById('search-card-view');
        const listBtn = document.getElementById('search-list-view');
        const techniqueList = document.getElementById('search-technique-list');

        // ボタンの状態を更新
        if (viewType === 'card') {
            cardBtn.classList.add('active');
            listBtn.classList.remove('active');
            techniqueList.classList.remove('list-view');
        } else {
            listBtn.classList.add('active');
            cardBtn.classList.remove('active');
            techniqueList.classList.add('list-view');
        }
    }

    toggleAdminView(viewType) {
        const cardBtn = document.getElementById('admin-card-view');
        const listBtn = document.getElementById('admin-list-view');
        const techniqueList = document.getElementById('admin-technique-list');

        // ボタンの状態を更新
        if (viewType === 'card') {
            cardBtn.classList.add('active');
            listBtn.classList.remove('active');
            techniqueList.classList.remove('list-view');
        } else {
            listBtn.classList.add('active');
            cardBtn.classList.remove('active');
            techniqueList.classList.add('list-view');
        }
    }

    setupModalListeners() {
        // モーダルを閉じるボタン
        const closeModalBtn = document.getElementById('close-modal');
        const modal = document.getElementById('technique-detail-modal');

        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => {
                this.closeTechniqueDetail();
            });
        }

        // モーダル背景クリックで閉じる
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeTechniqueDetail();
                }
            });
        }

        // Escキーでモーダルを閉じる
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeTechniqueDetail();
            }
        });
    }

    showTechniqueDetail(techniqueId) {
        // 技データを検索
        const technique = this.allTechniques.find(t => t.id === techniqueId);
        if (!technique) {
            console.error('技が見つかりません:', techniqueId);
            return;
        }

        // モーダルの内容を更新
        this.populateTechniqueModal(technique);

        // モーダルを表示
        const modal = document.getElementById('technique-detail-modal');
        if (modal) {
            modal.style.display = 'flex';
            // スクロールを無効化
            document.body.style.overflow = 'hidden';
        }
    }

    populateTechniqueModal(technique) {
        // 技名
        const nameElement = document.getElementById('modal-technique-name');
        if (nameElement) {
            nameElement.textContent = technique.名前;
        }

        // よみがな
        const readingElement = document.getElementById('modal-technique-reading');
        if (readingElement) {
            readingElement.textContent = technique.よみがな || '';
        }

        // カテゴリ
        const categoriesElement = document.getElementById('modal-technique-categories');
        if (categoriesElement && technique.カテゴリ) {
            categoriesElement.innerHTML = technique.カテゴリ.map(cat => 
                `<span class="category-tag">${cat}</span>`
            ).join('');
        }

        // 攻撃方法
        const attackElement = document.getElementById('modal-technique-attack');
        if (attackElement) {
            if (technique.攻撃) {
                attackElement.textContent = `攻撃: ${technique.攻撃}`;
                attackElement.style.display = 'block';
            } else {
                attackElement.style.display = 'none';
            }
        }

        // 概要説明
        const descriptionElement = document.getElementById('modal-technique-description');
        if (descriptionElement) {
            descriptionElement.textContent = technique.説明 || '説明がありません。';
        }

        // 詳細解説
        const detailedElement = document.getElementById('modal-technique-detailed');
        if (detailedElement) {
            detailedElement.textContent = technique.詳細解説 || '詳細解説がありません。';
        }

        // YouTube動画
        const videoContainer = document.getElementById('modal-technique-video');
        const iframe = document.getElementById('youtube-iframe');
        if (technique.youtube_url && iframe) {
            iframe.src = technique.youtube_url;
            videoContainer.style.display = 'block';
        } else {
            videoContainer.style.display = 'none';
        }
    }

    closeTechniqueDetail() {
        const modal = document.getElementById('technique-detail-modal');
        const iframe = document.getElementById('youtube-iframe');
        
        if (modal) {
            modal.style.display = 'none';
            // スクロールを再有効化
            document.body.style.overflow = '';
        }

        // YouTube動画を停止
        if (iframe) {
            iframe.src = '';
        }
    }

    setupSpeechSettingsListeners() {
        // 読み上げ速度の設定
        const speechRateInput = document.getElementById('speech-rate');
        const speechRateValue = document.getElementById('speech-rate-value');
        
        if (speechRateInput && speechRateValue) {
            speechRateInput.addEventListener('input', (e) => {
                speechRateValue.textContent = e.target.value;
            });
        }

        // 技間隔の設定
        const speechIntervalInput = document.getElementById('speech-interval');
        const speechIntervalValue = document.getElementById('speech-interval-value');
        
        if (speechIntervalInput && speechIntervalValue) {
            speechIntervalInput.addEventListener('input', (e) => {
                speechIntervalValue.textContent = e.target.value;
            });
        }
    }

    startSequentialReading() {
        if (!this.currentExamData || !this.currentExamData.科目) {
            this.showError('審査科目データが見つかりません。');
            return;
        }

        // 既に読み上げ中の場合は停止
        if (this.sequentialReading.isActive) {
            this.stopSequentialReading();
            return;
        }

        // 審査データから直接技IDリストを取得（JSONの順番通り）
        this.sequentialReading.isActive = true;
        this.sequentialReading.currentIndex = 0;
        this.sequentialReading.techniqueIds = [...this.currentExamData.科目];

        console.log('順次読み上げ開始:', this.sequentialReading.techniqueIds);

        // ボタンテキストを変更
        const sequentialBtn = document.getElementById('sequential-reading-btn');
        if (sequentialBtn) {
            sequentialBtn.textContent = '読み上げ停止';
            sequentialBtn.style.background = 'linear-gradient(45deg, #dc3545, #c82333)';
        }

        // 進行状況を表示
        const progressDiv = document.getElementById('reading-progress');
        if (progressDiv) {
            progressDiv.style.display = 'block';
        }

        // 読み上げ開始
        setTimeout(() => {
            console.log('読み上げ開始をトリガー');
            this.readNextTechnique();
        }, 100); // 少し遅延させて確実に実行
    }

    readNextTechnique() {
        console.log('readNextTechnique called:', {
            isActive: this.sequentialReading.isActive,
            currentIndex: this.sequentialReading.currentIndex,
            totalCount: this.sequentialReading.techniqueIds.length
        });

        if (!this.sequentialReading.isActive || 
            this.sequentialReading.currentIndex >= this.sequentialReading.techniqueIds.length) {
            console.log('順次読み上げ終了');
            this.stopSequentialReading();
            return;
        }

        const currentTechniqueId = this.sequentialReading.techniqueIds[this.sequentialReading.currentIndex];
        const currentIndex = this.sequentialReading.currentIndex;
        const totalCount = this.sequentialReading.techniqueIds.length;

        console.log(`読み上げ中: ${currentIndex + 1}/${totalCount} - ${currentTechniqueId}`);

        // 進行状況を更新
        this.updateReadingProgress(currentTechniqueId, currentIndex + 1, totalCount);

        // 技データを取得
        let displayName = currentTechniqueId;
        let reading = '';

        if (currentTechniqueId.includes('指定技')) {
            displayName = currentTechniqueId;
            reading = '';
            console.log('指定技:', displayName);
        } else if (currentTechniqueId.includes('自由技')) {
            displayName = currentTechniqueId;
            reading = '';
            console.log('自由技:', displayName);
        } else {
            const technique = this.allTechniques.find(t => t.id === currentTechniqueId);
            if (technique) {
                displayName = technique.名前;
                reading = technique.よみがな || '';
                console.log('通常の技:', displayName, reading);
            } else {
                console.log('技データが見つからない:', currentTechniqueId);
                displayName = currentTechniqueId;
            }
        }

        // 音声読み上げ
        console.log('音声読み上げ開始:', displayName);
        this.speakTechniqueWithCallback(displayName, reading, () => {
            console.log('音声読み上げ完了');
            // 読み上げ完了後、次の技へ
            this.sequentialReading.currentIndex++;
            
            // 間隔を取得
            const intervalInput = document.getElementById('speech-interval');
            const interval = intervalInput ? parseFloat(intervalInput.value) * 1000 : 3000;
            
            console.log(`${interval}ms後に次の技へ`);
            // 指定秒数後に次の技を読み上げ
            this.sequentialReading.timeoutId = setTimeout(() => {
                this.readNextTechnique();
            }, interval);
        });
    }

    updateReadingProgress(techniqueId, current, total) {
        const nameElement = document.getElementById('current-technique-name');
        const progressElement = document.getElementById('progress-info');

        if (nameElement) {
            let displayName = techniqueId;
            
            if (!techniqueId.includes('指定技') && !techniqueId.includes('自由技')) {
                const technique = this.allTechniques.find(t => t.id === techniqueId);
                if (technique) {
                    displayName = technique.名前;
                }
            }
            
            nameElement.textContent = displayName;
        }

        if (progressElement) {
            progressElement.textContent = `${current} / ${total}`;
        }
    }

    stopSequentialReading() {
        this.sequentialReading.isActive = false;
        
        // タイムアウトをクリア
        if (this.sequentialReading.timeoutId) {
            clearTimeout(this.sequentialReading.timeoutId);
            this.sequentialReading.timeoutId = null;
        }

        // 音声を停止
        this.stopSpeech();

        // ボタンテキストを元に戻す
        const sequentialBtn = document.getElementById('sequential-reading-btn');
        if (sequentialBtn) {
            sequentialBtn.textContent = '順次読み上げ';
            sequentialBtn.style.background = 'linear-gradient(45deg, #17a2b8, #138496)';
        }

        // 進行状況を非表示
        const progressDiv = document.getElementById('reading-progress');
        if (progressDiv) {
            progressDiv.style.display = 'none';
        }
    }

    speakTechniqueWithCallback(name, reading, callback) {
        // 既存の音声のみを停止（順次読み上げ状態は保持）
        if (this.speechSynthesis.speaking) {
            this.speechSynthesis.cancel();
        }
        
        // 読み上げるテキストを準備
        const textToSpeak = reading || name;
        
        // 音声設定を取得
        const rateInput = document.getElementById('speech-rate');
        const rate = rateInput ? parseFloat(rateInput.value) : 0.8;

        console.log('音声合成設定:', { textToSpeak, rate });

        // 音声合成の設定
        this.currentUtterance = new SpeechSynthesisUtterance(textToSpeak);
        this.currentUtterance.lang = 'ja-JP';
        this.currentUtterance.rate = rate;
        this.currentUtterance.pitch = 1.0;
        this.currentUtterance.volume = 1.0;
        
        // 読み上げ開始・終了イベント
        this.currentUtterance.onstart = () => {
            console.log('音声読み上げ開始:', textToSpeak);
            document.getElementById('stop-speech-btn').style.display = 'inline-block';
        };
        
        // 読み上げ終了時のコールバック
        this.currentUtterance.onend = () => {
            console.log('音声読み上げ終了:', textToSpeak);
            if (callback) {
                callback();
            }
        };

        // エラーハンドリング
        this.currentUtterance.onerror = (event) => {
            console.error('音声読み上げエラー:', event);
            if (callback) {
                callback();
            }
        };
        
        // 音声読み上げ開始
        this.speechSynthesis.speak(this.currentUtterance);
    }

    populateExamCategories() {
        // 審査区分データが存在することを確認
        if (!this.data || !this.data.審査区分) {
            console.error('審査区分データが見つかりません');
            return;
        }
        
        // すでにオプションが設定されているので、追加処理は不要
        console.log('審査区分が利用可能:', Object.keys(this.data.審査区分));
    }

    onExamCategoryChange() {
        const examCategory = document.getElementById('exam-category').value;
        const gradeSelection = document.getElementById('grade-selection');
        const gradeSelect = document.getElementById('grade');
        const techniqueSection = document.getElementById('technique-section');

        if (!examCategory) {
            gradeSelection.style.display = 'none';
            techniqueSection.style.display = 'none';
            return;
        }

        // 級・段の選択肢をクリア
        gradeSelect.innerHTML = '<option value="">選択してください</option>';

        // 選択された審査区分の級・段を取得
        const examData = this.data.審査区分[examCategory];
        if (examData) {
            Object.keys(examData).forEach(grade => {
                const option = document.createElement('option');
                option.value = grade;
                option.textContent = grade;
                gradeSelect.appendChild(option);
            });
            gradeSelection.style.display = 'block';
        }

        techniqueSection.style.display = 'none';
    }

    onGradeChange() {
        const examCategory = document.getElementById('exam-category').value;
        const grade = document.getElementById('grade').value;
        const techniqueSection = document.getElementById('technique-section');

        if (!examCategory || !grade) {
            techniqueSection.style.display = 'none';
            return;
        }

        // 選択された級・段の審査データを取得
        this.currentExamData = this.data.審査区分[examCategory][grade];
        
        if (this.currentExamData && this.currentExamData.科目) {
            techniqueSection.style.display = 'block';
            this.clearTechniqueDisplay();
            this.updateDesignatedTechniqueButton();
            // 自動で技リストを表示
            this.showAllTechniques();
        }
    }

    showAllTechniques() {
        if (!this.currentExamData || !this.currentExamData.科目) {
            this.showError('審査科目データが見つかりません。');
            return;
        }

        const techniqueList = document.getElementById('technique-list');
        const randomTechnique = document.getElementById('random-technique');
        
        randomTechnique.style.display = 'none';
        techniqueList.innerHTML = '';

        // 補足情報を表示
        this.displaySupplementaryInfo();

        // 審査支援ではリスト表示用のクラスを適用
        techniqueList.className = 'exam-technique-list';

        // JSONデータの順番通りに技を表示（指定技や自由技も含む）
        this.currentExamData.科目.forEach((item, index) => {
            const techniqueElement = this.createExamTechniqueElement(item, index);
            techniqueList.appendChild(techniqueElement);
        });
    }

    displaySupplementaryInfo() {
        const supplementaryInfoDiv = document.getElementById('supplementary-info');
        const supplementaryContent = document.getElementById('supplementary-content');
        
        // 補足情報がある場合のみ表示
        if (this.currentExamData && this.currentExamData.補足) {
            const supplementaryItems = this.currentExamData.補足;
            
            if (Array.isArray(supplementaryItems) && supplementaryItems.length > 0) {
                // 配列の場合はリスト表示
                const listHtml = '<ul>' + 
                    supplementaryItems.map(item => `<li>${item}</li>`).join('') + 
                    '</ul>';
                supplementaryContent.innerHTML = listHtml;
                supplementaryInfoDiv.style.display = 'block';
            } else if (typeof supplementaryItems === 'string') {
                // 文字列の場合はそのまま表示
                supplementaryContent.innerHTML = `<p>${supplementaryItems}</p>`;
                supplementaryInfoDiv.style.display = 'block';
            } else {
                supplementaryInfoDiv.style.display = 'none';
            }
        } else {
            supplementaryInfoDiv.style.display = 'none';
        }
    }

    showDesignatedTechniques() {
        if (!this.currentExamData) {
            this.showError('審査データが見つかりません。');
            return;
        }

        const techniqueList = document.getElementById('technique-list');
        const randomTechnique = document.getElementById('random-technique');
        
        randomTechnique.style.display = 'none';
        techniqueList.innerHTML = '';

        // 補足情報を表示
        this.displaySupplementaryInfo();

        // 指定技リストを取得
        const designatedTechniques = this.getDesignatedTechniques();
        if (designatedTechniques.length === 0) {
            techniqueList.innerHTML = '<p style="text-align: center; color: #6c757d; margin-top: 20px;">指定技が設定されていません。</p>';
            return;
        }

        // 既存の審査科目に含まれている技を除外
        const existingTechniqueIds = this.currentExamData.科目 || [];
        const availableDesignatedTechniques = designatedTechniques.filter(technique => 
            !existingTechniqueIds.includes(technique.id)
        );

        if (availableDesignatedTechniques.length === 0) {
            techniqueList.innerHTML = '<p style="text-align: center; color: #6c757d; margin-top: 20px;">選択可能な指定技がありません（全て審査科目に含まれています）。</p>';
            return;
        }

        // 指定技を表示（リスト形式）
        techniqueList.className = 'exam-technique-list';
        
        availableDesignatedTechniques.forEach((technique, index) => {
            const techniqueElement = this.createExamTechniqueElement(technique.id, index);
            techniqueElement.classList.add('designated-technique');
            techniqueList.appendChild(techniqueElement);
        });
    }

    selectRandomTechnique() {
        if (!this.currentExamData || !this.currentExamData.科目) {
            this.showError('審査科目データが見つかりません。');
            return;
        }

        // JSON順番から直接ランダム選択
        const techniqueIds = this.currentExamData.科目;
        if (techniqueIds.length === 0) {
            this.showError('利用可能な技が見つかりません。');
            return;
        }

        const randomIndex = Math.floor(Math.random() * techniqueIds.length);
        const selectedTechniqueId = techniqueIds[randomIndex];

        // 指定技や自由技も含めて対応
        this.displayRandomTechniqueFromId(selectedTechniqueId, randomIndex + 1);
    }

    selectRandomDesignatedTechnique() {
        if (!this.currentExamData) {
            this.showError('審査データが見つかりません。');
            return;
        }

        // 指定技リストを取得
        const designatedTechniques = this.getDesignatedTechniques();
        if (designatedTechniques.length === 0) {
            this.showError('指定技が見つかりません。');
            return;
        }

        // 既存の審査科目に含まれている技を除外
        const existingTechniqueIds = this.currentExamData.科目 || [];
        const availableDesignatedTechniques = designatedTechniques.filter(technique => 
            !existingTechniqueIds.includes(technique.id)
        );

        if (availableDesignatedTechniques.length === 0) {
            this.showError('選択可能な指定技がありません（全て審査科目に含まれています）。');
            return;
        }

        const randomIndex = Math.floor(Math.random() * availableDesignatedTechniques.length);
        const selectedTechnique = availableDesignatedTechniques[randomIndex];

        this.displayRandomTechnique(selectedTechnique);
        this.speakTechnique(selectedTechnique.名前, selectedTechnique.よみがな);
    }

    getDesignatedTechniques() {
        if (!this.currentExamData || !this.currentExamData.指定技範囲) {
            return [];
        }

        const designatedTechniques = [];
        const designatedRange = this.currentExamData.指定技範囲;

        if (Array.isArray(designatedRange)) {
            // 指定技範囲が配列の場合（例: ["waza_001-waza_002", "waza_005-waza_006"]）
            designatedRange.forEach(range => {
                const techniques = this.parseTechniqueRange(range);
                designatedTechniques.push(...techniques);
            });
        } else if (typeof designatedRange === 'string') {
            // 指定技範囲が文字列の場合（説明文など）
            // この場合は有段審査の指定技リストを使用
            const danGradeDesignatedTechniques = this.getDanGradeDesignatedTechniques();
            designatedTechniques.push(...danGradeDesignatedTechniques);
        }

        return designatedTechniques;
    }

    parseTechniqueRange(range) {
        const techniques = [];
        
        if (range.includes('-')) {
            // 範囲指定の場合（例: "waza_001-waza_002"）
            const [start, end] = range.split('-');
            const startNum = parseInt(start.split('_')[1]);
            const endNum = parseInt(end.split('_')[1]);
            const prefix = start.split('_')[0];
            
            for (let i = startNum; i <= endNum; i++) {
                const techniqueId = `${prefix}_${String(i).padStart(3, '0')}`;
                const technique = this.allTechniques.find(t => t.id === techniqueId);
                if (technique) {
                    techniques.push(technique);
                }
            }
        } else {
            // 単一技指定の場合
            const technique = this.allTechniques.find(t => t.id === range);
            if (technique) {
                techniques.push(technique);
            }
        }
        
        return techniques;
    }

    getDanGradeDesignatedTechniques() {
        // 有段審査の指定技リストから対応する技を検索
        if (!this.data.有段審査 || !this.data.有段審査.指定技 || !this.data.有段審査.指定技.技リスト) {
            return [];
        }

        const designatedTechniques = [];
        const techniqueList = this.data.有段審査.指定技.技リスト;

        techniqueList.forEach(techniqueName => {
            // ※マークを除去
            const cleanName = techniqueName.replace(/※/g, '');
            
            // 技名の一部マッチングで技を検索
            const matchingTechniques = this.allTechniques.filter(technique => {
                if (!technique.名前) return false;
                
                // 基本的な名前マッチング
                if (cleanName.includes(technique.名前)) {
                    return true;
                }
                
                // （一）（二）の形式も考慮
                const baseName = technique.名前.replace(/（[一二]）/g, '');
                if (cleanName.includes(baseName)) {
                    return true;
                }
                
                return false;
            });
            
            designatedTechniques.push(...matchingTechniques);
        });

        // 重複を除去
        const uniqueTechniques = designatedTechniques.filter((technique, index, self) => 
            index === self.findIndex(t => t.id === technique.id)
        );

        return uniqueTechniques;
    }

    updateDesignatedTechniqueButton() {
        const randomDesignatedBtn = document.getElementById('random-designated-btn');
        const showDesignatedBtn = document.getElementById('show-designated-btn');
        const randomSelectBtn = document.getElementById('random-select-btn');
        const sequentialReadingBtn = document.getElementById('sequential-reading-btn');
        
        // 指定技範囲が設定されているかチェック
        if (this.currentExamData && this.currentExamData.指定技範囲) {
            // 指定技の数を計算
            const designatedTechniques = this.getDesignatedTechniques();
            const existingTechniqueIds = this.currentExamData.科目 || [];
            const availableCount = designatedTechniques.filter(technique => 
                !existingTechniqueIds.includes(technique.id)
            ).length;
            
            // 指定技関連ボタンを表示
            if (randomDesignatedBtn) {
                randomDesignatedBtn.style.display = 'inline-block';
                randomDesignatedBtn.textContent = `指定技ランダム (${availableCount}件)`;
            }
            
            if (showDesignatedBtn) {
                showDesignatedBtn.style.display = 'inline-block';
                showDesignatedBtn.textContent = `指定技のみ表示 (${availableCount}件)`;
            }

            // 通常のランダム選択ボタンを表示
            if (randomSelectBtn) {
                randomSelectBtn.style.display = 'inline-block';
            }

            // 順次読み上げボタンを非表示
            if (sequentialReadingBtn) {
                sequentialReadingBtn.style.display = 'none';
            }
        } else {
            // 指定技範囲が設定されていない場合
            if (randomDesignatedBtn) {
                randomDesignatedBtn.style.display = 'none';
            }
            if (showDesignatedBtn) {
                showDesignatedBtn.style.display = 'none';
            }

            // 通常のランダム選択ボタンを非表示
            if (randomSelectBtn) {
                randomSelectBtn.style.display = 'none';
            }

            // 順次読み上げボタンを表示
            if (sequentialReadingBtn) {
                sequentialReadingBtn.style.display = 'inline-block';
            }
        }
    }

    getTechniquesFromIds(techniqueIds) {
        const techniques = [];
        
        techniqueIds.forEach(id => {
            let technique = null;
            
            // 基本動作から検索
            if (this.data.技術データベース.基本動作) {
                technique = this.data.技術データベース.基本動作.find(item => item.id === id);
            }
            
            // 技法から検索
            if (!technique && this.data.技術データベース.技法) {
                technique = this.data.技術データベース.技法.find(item => item.id === id);
            }
            
            if (technique) {
                techniques.push(technique);
            } else {
                console.warn(`技術ID "${id}" が見つかりません`);
            }
        });
        
        return techniques;
    }

    createTechniqueElement(technique) {
        const div = document.createElement('div');
        div.className = 'technique-item';
        div.dataset.techniqueId = technique.id; // 技IDをdata属性として追加
        
        const categories = technique.カテゴリ ? technique.カテゴリ.map(cat => 
            `<span class="category-tag">${cat}</span>`
        ).join('') : '';
        
        div.innerHTML = `
            <h3>${technique.名前}</h3>
            <div class="reading">${technique.よみがな || ''}</div>
            <div class="description">${technique.説明 || ''}</div>
            <div class="categories">${categories}</div>
        `;
        
        return div;
    }

    createExamTechniqueElement(techniqueId, index) {
        const div = document.createElement('div');
        div.className = 'exam-technique-item';
        
        // 技のタイプを判定
        let techniqueType = '';
        let techniqueData = null;
        let displayName = techniqueId;
        let reading = '';
        let description = '';
        let categories = [];

        if (techniqueId.includes('指定技')) {
            // 指定技の場合
            techniqueType = 'designated';
            div.classList.add('designated-technique');
            displayName = techniqueId;
            description = 'この審査区分の指定技範囲からランダムに選択されます';
        } else if (techniqueId.includes('自由技')) {
            // 自由技の場合
            techniqueType = 'free';
            div.classList.add('free-technique');
            displayName = techniqueId;
            description = '相手の攻撃に対して自由に技を選択して行います';
        } else {
            // 通常の技の場合
            techniqueData = this.allTechniques.find(t => t.id === techniqueId);
            if (techniqueData) {
                displayName = techniqueData.名前;
                reading = techniqueData.よみがな || '';
                description = techniqueData.説明 || '';
                categories = techniqueData.カテゴリ || [];
                
                // 基本動作かどうかを判定
                if (techniqueData.id.startsWith('basic_')) {
                    techniqueType = 'basic';
                }
            } else {
                // 技データが見つからない場合（文字列で記載されている技など）
                displayName = techniqueId;
                description = '技の詳細情報が設定されていません';
            }
        }

        // data属性を設定
        if (techniqueData) {
            div.dataset.techniqueId = techniqueData.id;
        }

        // カテゴリタグの生成
        const categoryTags = categories.map(cat => 
            `<span class="category-tag">${cat}</span>`
        ).join('');

        // 技タイプバッジの生成
        let typeBadge = '';
        if (techniqueType === 'designated') {
            typeBadge = '<span class="exam-technique-type designated">指定技</span>';
        } else if (techniqueType === 'free') {
            typeBadge = '<span class="exam-technique-type free">自由技</span>';
        } else if (techniqueType === 'basic') {
            typeBadge = '<span class="exam-technique-type basic">基本動作</span>';
        }

        div.innerHTML = `
            <div class="exam-technique-content">
                <div class="exam-technique-name">${displayName}</div>
                <div class="exam-technique-reading">${reading}</div>
                <div class="exam-technique-description">${description}</div>
                <div class="exam-technique-categories">${categoryTags}</div>
                ${typeBadge}
            </div>
        `;

        return div;
    }

    displayRandomTechnique(technique) {
        const randomTechnique = document.getElementById('random-technique');
        const selectedTechnique = document.getElementById('selected-technique');
        const techniqueList = document.getElementById('technique-list');
        
        techniqueList.innerHTML = '';
        
        const categories = technique.カテゴリ ? technique.カテゴリ.join('・') : '';
        
        selectedTechnique.innerHTML = `
            <h4>${technique.名前}</h4>
            <div class="reading">${technique.よみがな || ''}</div>
            <div class="description">${technique.説明 || ''}</div>
            ${categories ? `<div class="categories" style="margin-top: 15px; opacity: 0.8;">${categories}</div>` : ''}
        `;
        
        randomTechnique.style.display = 'block';
    }

    displayRandomTechniqueFromId(techniqueId, orderNumber) {
        const randomTechnique = document.getElementById('random-technique');
        const selectedTechnique = document.getElementById('selected-technique');
        const techniqueList = document.getElementById('technique-list');
        
        techniqueList.innerHTML = '';
        
        let displayName = techniqueId;
        let reading = '';
        let description = '';
        let categories = '';
        let textToSpeak = '';

        if (techniqueId.includes('指定技')) {
            // 指定技の場合
            displayName = techniqueId;
            reading = '';
            description = 'この審査区分の指定技範囲からランダムに選択されます';
            textToSpeak = techniqueId;
        } else if (techniqueId.includes('自由技')) {
            // 自由技の場合
            displayName = techniqueId;
            reading = '';
            description = '相手の攻撃に対して自由に技を選択して行います';
            textToSpeak = techniqueId;
        } else {
            // 通常の技の場合
            const technique = this.allTechniques.find(t => t.id === techniqueId);
            if (technique) {
                displayName = technique.名前;
                reading = technique.よみがな || '';
                description = technique.説明 || '';
                categories = technique.カテゴリ ? technique.カテゴリ.join('・') : '';
                textToSpeak = reading || displayName;
            } else {
                // 技データが見つからない場合
                displayName = techniqueId;
                reading = '';
                description = '技の詳細情報が設定されていません';
                textToSpeak = techniqueId;
            }
        }
        
        selectedTechnique.innerHTML = `
            <h4>${displayName} <span style="font-size: 0.8em; opacity: 0.8;">(${orderNumber}番目)</span></h4>
            <div class="reading">${reading}</div>
            <div class="description">${description}</div>
            ${categories ? `<div class="categories" style="margin-top: 15px; opacity: 0.8;">${categories}</div>` : ''}
        `;
        
        randomTechnique.style.display = 'block';
        
        // 音声読み上げ
        this.speakTechnique(displayName, reading);
    }

    speakTechnique(name, reading) {
        // 既存の音声を停止
        this.stopSpeech();
        
        // 読み上げるテキストを準備
        const textToSpeak = reading || name;
        
        // 音声設定を取得
        const rateInput = document.getElementById('speech-rate');
        const rate = rateInput ? parseFloat(rateInput.value) : 0.8;
        
        // 音声合成の設定
        this.currentUtterance = new SpeechSynthesisUtterance(textToSpeak);
        this.currentUtterance.lang = 'ja-JP';
        this.currentUtterance.rate = rate;
        this.currentUtterance.pitch = 1.0;
        this.currentUtterance.volume = 1.0;
        
        // 読み上げ開始・終了イベント
        this.currentUtterance.onstart = () => {
            document.getElementById('stop-speech-btn').style.display = 'inline-block';
            // 読み上げ中のアニメーション
            const randomTechnique = document.getElementById('random-technique');
            if (randomTechnique.style.display !== 'none') {
                randomTechnique.classList.add('speaking');
            }
        };
        
        this.currentUtterance.onend = () => {
            document.getElementById('stop-speech-btn').style.display = 'none';
            document.querySelectorAll('.speaking').forEach(el => {
                el.classList.remove('speaking');
            });
        };
        
        // 音声読み上げ開始
        this.speechSynthesis.speak(this.currentUtterance);
    }

    stopSpeech() {
        // 順次読み上げも停止
        if (this.sequentialReading.isActive) {
            this.stopSequentialReading();
        }
        
        if (this.speechSynthesis.speaking) {
            this.speechSynthesis.cancel();
        }
        document.getElementById('stop-speech-btn').style.display = 'none';
        document.querySelectorAll('.speaking').forEach(el => {
            el.classList.remove('speaking');
        });
    }

    clearTechniqueDisplay() {
        document.getElementById('technique-list').innerHTML = '';
        document.getElementById('random-technique').style.display = 'none';
        document.getElementById('supplementary-info').style.display = 'none';
    }

    showError(message) {
        // 簡単なエラー表示
        alert(message);
    }

    // 検索機能
    performSearch() {
        const searchText = document.getElementById('search-text').value.trim().toLowerCase();
        const selectedCategories = Array.from(document.querySelectorAll('.category-filter:checked')).map(cb => cb.value);
        const selectedAttacks = Array.from(document.querySelectorAll('.attack-filter:checked')).map(cb => cb.value);
        const selectedPositions = Array.from(document.querySelectorAll('.position-filter:checked')).map(cb => cb.value);
        const selectedExamCategory = document.getElementById('search-exam-category').value;
        const selectedExamGrade = document.getElementById('search-exam-grade').value;

        let filteredTechniques = this.allTechniques.filter(technique => {
            // キーワード検索
            if (searchText) {
                const matchesText = 
                    (technique.名前 && technique.名前.toLowerCase().includes(searchText)) ||
                    (technique.よみがな && technique.よみがな.toLowerCase().includes(searchText)) ||
                    (technique.説明 && technique.説明.toLowerCase().includes(searchText)) ||
                    (technique.攻撃 && technique.攻撃.toLowerCase().includes(searchText));
                
                if (!matchesText) return false;
            }

            // カテゴリフィルター
            if (selectedCategories.length > 0) {
                const hasMatchingCategory = technique.カテゴリ && 
                    technique.カテゴリ.some(cat => selectedCategories.includes(cat));
                if (!hasMatchingCategory) return false;
            }

            // 攻撃種類フィルター
            if (selectedAttacks.length > 0) {
                if (!technique.攻撃 || !selectedAttacks.includes(technique.攻撃)) return false;
            }

            // 立ち座りフィルター
            if (selectedPositions.length > 0) {
                const hasMatchingPosition = technique.カテゴリ && 
                    technique.カテゴリ.some(cat => selectedPositions.includes(cat));
                if (!hasMatchingPosition) return false;
            }

            // 審査区分・級段フィルター
            if (selectedExamCategory && selectedExamGrade) {
                const isInExam = this.isTechniqueInExam(technique.id, selectedExamCategory, selectedExamGrade);
                if (!isInExam) return false;
            } else if (selectedExamCategory) {
                const isInAnyGradeOfCategory = this.isTechniqueInAnyGradeOfCategory(technique.id, selectedExamCategory);
                if (!isInAnyGradeOfCategory) return false;
            }

            return true;
        });

        this.displaySearchResults(filteredTechniques);
    }

    updateSearchExamGrades() {
        const examCategory = document.getElementById('search-exam-category').value;
        const gradeSelect = document.getElementById('search-exam-grade');
        
        gradeSelect.innerHTML = '<option value="">すべて</option>';
        
        if (examCategory && this.data.審査区分[examCategory]) {
            Object.keys(this.data.審査区分[examCategory]).forEach(grade => {
                const option = document.createElement('option');
                option.value = grade;
                option.textContent = grade;
                gradeSelect.appendChild(option);
            });
        }
    }

    isTechniqueInExam(techniqueId, examCategory, grade) {
        if (!this.data.審査区分[examCategory] || !this.data.審査区分[examCategory][grade]) {
            return false;
        }
        
        const examData = this.data.審査区分[examCategory][grade];
        return examData.科目 && examData.科目.includes(techniqueId);
    }

    isTechniqueInAnyGradeOfCategory(techniqueId, examCategory) {
        if (!this.data.審査区分[examCategory]) {
            return false;
        }
        
        return Object.values(this.data.審査区分[examCategory]).some(gradeData => {
            return gradeData.科目 && gradeData.科目.includes(techniqueId);
        });
    }

    clearSearch() {
        // テキスト検索をクリア
        document.getElementById('search-text').value = '';
        
        // チェックボックスをすべてクリア
        document.querySelectorAll('.category-filter, .attack-filter, .position-filter').forEach(checkbox => {
            checkbox.checked = false;
        });

        // 審査区分フィルターをクリア
        document.getElementById('search-exam-category').value = '';
        document.getElementById('search-exam-grade').innerHTML = '<option value="">審査区分を選択してください</option>';

        // 検索結果をクリア
        this.displaySearchResults([]);
    }

    showAllTechniquesInSearch() {
        this.displaySearchResults(this.allTechniques);
    }

    displaySearchResults(techniques) {
        const resultsCount = document.getElementById('search-results-count');
        const techniqueList = document.getElementById('search-technique-list');

        resultsCount.textContent = `${techniques.length}件の技が見つかりました`;
        techniqueList.innerHTML = '';

        techniques.forEach(technique => {
            const techniqueElement = this.createTechniqueElement(technique);
            techniqueList.appendChild(techniqueElement);
        });
    }

    // 管理者機能
    setupAdminTabs() {
        const techniqueTab = document.getElementById('technique-management-tab');
        const tagTab = document.getElementById('tag-management-tab');
        const exportTab = document.getElementById('data-export-tab');

        [techniqueTab, tagTab, exportTab].forEach(tab => {
            if (tab) {
                tab.addEventListener('click', (e) => {
                    this.switchAdminTab(e.target.id.replace('-tab', ''));
                });
            }
        });
    }

    switchAdminTab(tabName) {
        // タブボタンの状態更新
        document.querySelectorAll('.admin-tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById(tabName + '-tab').classList.add('active');

        // コンテンツの表示切替
        document.querySelectorAll('.admin-content').forEach(content => {
            content.style.display = 'none';
        });
        document.getElementById(tabName.replace('-', '-')).style.display = 'block';

        // 各タブの初期化
        if (tabName === 'technique-management') {
            this.loadAdminTechniques();
        } else if (tabName === 'tag-management') {
            this.loadTagManagement();
        }
    }

    showTechniqueForm(technique = null) {
        const form = document.getElementById('technique-edit-form');
        const formTitle = document.getElementById('form-title');
        const deleteBtn = document.getElementById('delete-technique-btn');

        this.currentEditingTechnique = technique;

        if (technique) {
            formTitle.textContent = '技を編集';
            deleteBtn.style.display = 'block';
            this.populateTechniqueForm(technique);
        } else {
            formTitle.textContent = '新しい技を追加';
            deleteBtn.style.display = 'none';
            this.clearTechniqueForm();
        }

        form.style.display = 'block';
    }

    hideTechniqueForm() {
        document.getElementById('technique-edit-form').style.display = 'none';
        this.currentEditingTechnique = null;
    }

    populateTechniqueForm(technique) {
        document.getElementById('technique-id').value = technique.id || '';
        document.getElementById('technique-name').value = technique.名前 || '';
        document.getElementById('technique-reading').value = technique.よみがな || '';
        document.getElementById('technique-description').value = technique.説明 || '';
        document.getElementById('technique-attack').value = technique.攻撃 || '';
        document.getElementById('technique-form-type').value = technique.形式 || '';
        
        const categories = technique.カテゴリ ? technique.カテゴリ.join(', ') : '';
        document.getElementById('technique-categories').value = categories;
    }

    clearTechniqueForm() {
        document.getElementById('technique-form').reset();
    }

    saveTechnique() {
        const formData = {
            id: document.getElementById('technique-id').value.trim(),
            名前: document.getElementById('technique-name').value.trim(),
            よみがな: document.getElementById('technique-reading').value.trim(),
            説明: document.getElementById('technique-description').value.trim(),
            攻撃: document.getElementById('technique-attack').value.trim(),
            形式: document.getElementById('technique-form-type').value,
            カテゴリ: document.getElementById('technique-categories').value
                .split(',').map(cat => cat.trim()).filter(cat => cat)
        };

        if (!formData.id || !formData.名前) {
            this.showError('IDと技名は必須です。');
            return;
        }

        try {
            if (this.currentEditingTechnique) {
                // 編集モード
                this.updateTechniqueInData(formData);
            } else {
                // 新規追加モード
                this.addTechniqueToData(formData);
            }

            this.extractAllTechniques();
            this.extractAllTags();
            this.loadAdminTechniques();
            this.hideTechniqueForm();
            
            this.showSuccess('技が保存されました。');
        } catch (error) {
            console.error('技の保存エラー:', error);
            this.showError('技の保存に失敗しました。');
        }
    }

    updateTechniqueInData(formData) {
        let updated = false;

        // 基本動作を検索
        if (this.data.技術データベース.基本動作) {
            const index = this.data.技術データベース.基本動作.findIndex(
                t => t.id === this.currentEditingTechnique.id
            );
            if (index !== -1) {
                this.data.技術データベース.基本動作[index] = formData;
                updated = true;
            }
        }

        // 技法を検索
        if (!updated && this.data.技術データベース.技法) {
            const index = this.data.技術データベース.技法.findIndex(
                t => t.id === this.currentEditingTechnique.id
            );
            if (index !== -1) {
                this.data.技術データベース.技法[index] = formData;
                updated = true;
            }
        }

        if (!updated) {
            throw new Error('更新する技が見つかりません');
        }
    }

    addTechniqueToData(formData) {
        // IDの重複チェック
        const existingTechnique = this.allTechniques.find(t => t.id === formData.id);
        if (existingTechnique) {
            throw new Error('同じIDの技が既に存在します。');
        }

        // 基本動作か技法かを判定（IDプレフィックスで判断）
        if (formData.id.startsWith('basic_')) {
            if (!this.data.技術データベース.基本動作) {
                this.data.技術データベース.基本動作 = [];
            }
            this.data.技術データベース.基本動作.push(formData);
        } else {
            if (!this.data.技術データベース.技法) {
                this.data.技術データベース.技法 = [];
            }
            this.data.技術データベース.技法.push(formData);
        }
    }

    deleteTechnique() {
        if (!this.currentEditingTechnique) return;

        if (!confirm('この技を削除しますか？この操作は取り消せません。')) return;

        try {
            this.deleteTechniqueFromData(this.currentEditingTechnique);
            this.extractAllTechniques();
            this.extractAllTags();
            this.loadAdminTechniques();
            this.hideTechniqueForm();
            
            this.showSuccess('技が削除されました。');
        } catch (error) {
            console.error('技の削除エラー:', error);
            this.showError('技の削除に失敗しました。');
        }
    }

    deleteTechniqueFromData(technique) {
        let deleted = false;

        // 基本動作から削除
        if (this.data.技術データベース.基本動作) {
            const index = this.data.技術データベース.基本動作.findIndex(
                t => t.id === technique.id
            );
            if (index !== -1) {
                this.data.技術データベース.基本動作.splice(index, 1);
                deleted = true;
            }
        }

        // 技法から削除
        if (!deleted && this.data.技術データベース.技法) {
            const index = this.data.技術データベース.技法.findIndex(
                t => t.id === technique.id
            );
            if (index !== -1) {
                this.data.技術データベース.技法.splice(index, 1);
                deleted = true;
            }
        }

        if (!deleted) {
            throw new Error('削除する技が見つかりません');
        }
    }

    loadAdminTechniques() {
        this.populateAdminFilterOptions();
        this.displayAdminTechniques(this.allTechniques);
    }

    populateAdminFilterOptions() {
        // カテゴリの選択肢を動的生成
        const categorySelect = document.getElementById('admin-filter-category');
        const attackSelect = document.getElementById('admin-filter-attack');
        
        if (categorySelect) {
            categorySelect.innerHTML = '<option value="">すべて</option>';
            const categories = new Set();
            this.allTechniques.forEach(technique => {
                if (technique.カテゴリ && Array.isArray(technique.カテゴリ)) {
                    technique.カテゴリ.forEach(cat => categories.add(cat));
                }
            });
            Array.from(categories).sort().forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                categorySelect.appendChild(option);
            });
        }

        // 攻撃種類の選択肢を動的生成
        if (attackSelect) {
            attackSelect.innerHTML = '<option value="">すべて</option>';
            const attacks = new Set();
            this.allTechniques.forEach(technique => {
                if (technique.攻撃) {
                    attacks.add(technique.攻撃);
                }
            });
            Array.from(attacks).sort().forEach(attack => {
                const option = document.createElement('option');
                option.value = attack;
                option.textContent = attack;
                attackSelect.appendChild(option);
            });
        }
    }

    displayAdminTechniques(techniques) {
        const techniqueList = document.getElementById('admin-technique-list');
        const filterCount = document.getElementById('admin-filter-count');
        
        techniqueList.innerHTML = '';
        
        techniques.forEach(technique => {
            const element = this.createAdminTechniqueElement(technique);
            techniqueList.appendChild(element);
        });

        if (filterCount) {
            filterCount.textContent = `${techniques.length}件の技を表示中`;
        }
    }

    createAdminTechniqueElement(technique) {
        const div = document.createElement('div');
        div.className = 'admin-technique-item';

        const categories = technique.カテゴリ ? technique.カテゴリ.join('・') : '';
        const attack = technique.攻撃 ? `攻撃: ${technique.攻撃}` : '';
        const form = technique.形式 ? `形式: ${technique.形式}` : '';

        div.innerHTML = `
            <div class="admin-actions">
                <button class="admin-btn edit" onclick="app.editTechnique('${technique.id}')">編集</button>
                <button class="admin-btn delete" onclick="app.deleteTechniqueById('${technique.id}')">削除</button>
            </div>
            <h4>${technique.名前}</h4>
            <div class="technique-id">ID: ${technique.id}</div>
            <div class="technique-meta">
                <div>読み: ${technique.よみがな || '未設定'}</div>
                <div>説明: ${technique.説明 || '未設定'}</div>
                ${attack ? `<div>${attack}</div>` : ''}
                ${form ? `<div>${form}</div>` : ''}
                ${categories ? `<div>カテゴリ: ${categories}</div>` : ''}
            </div>
        `;

        return div;
    }

    editTechnique(techniqueId) {
        const technique = this.allTechniques.find(t => t.id === techniqueId);
        if (technique) {
            this.showTechniqueForm(technique);
        }
    }

    deleteTechniqueById(techniqueId) {
        const technique = this.allTechniques.find(t => t.id === techniqueId);
        if (technique) {
            this.currentEditingTechnique = technique;
            this.deleteTechnique();
        }
    }

    // タグ管理
    loadTagManagement() {
        this.displayTagList();
        this.displayTagUsageStats();
    }

    displayTagList() {
        const tagList = document.getElementById('tag-list');
        tagList.innerHTML = '';

        const tagUsageCount = this.getTagUsageCount();

        Array.from(this.allTags).sort().forEach(tag => {
            const tagElement = document.createElement('div');
            tagElement.className = 'tag-item';
            tagElement.innerHTML = `
                <span>${tag}</span>
                <span class="tag-count">${tagUsageCount[tag] || 0}</span>
                <button class="remove-tag" onclick="app.removeTag('${tag}')">&times;</button>
            `;
            tagList.appendChild(tagElement);
        });
    }

    getTagUsageCount() {
        const count = {};
        this.allTechniques.forEach(technique => {
            if (technique.カテゴリ) {
                technique.カテゴリ.forEach(tag => {
                    count[tag] = (count[tag] || 0) + 1;
                });
            }
            if (technique.攻撃) {
                count[technique.攻撃] = (count[technique.攻撃] || 0) + 1;
            }
        });
        return count;
    }

    displayTagUsageStats() {
        const statsContainer = document.getElementById('tag-usage-stats');
        const tagUsageCount = this.getTagUsageCount();
        
        const sortedTags = Object.entries(tagUsageCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        statsContainer.innerHTML = `
            <h4>使用頻度上位10タグ</h4>
            <div class="stats-list">
                ${sortedTags.map(([tag, count]) => 
                    `<div class="stats-item">${tag}: ${count}回使用</div>`
                ).join('')}
            </div>
        `;
    }

    addNewTag() {
        const input = document.getElementById('new-tag-input');
        const newTag = input.value.trim();

        if (!newTag) {
            this.showError('タグ名を入力してください。');
            return;
        }

        if (this.allTags.has(newTag)) {
            this.showError('そのタグは既に存在します。');
            return;
        }

        this.allTags.add(newTag);
        input.value = '';
        this.displayTagList();
        this.showSuccess(`タグ「${newTag}」を追加しました。`);
    }

    removeTag(tagName) {
        if (!confirm(`タグ「${tagName}」を削除しますか？\n注意: このタグを使用している技からも削除されます。`)) {
            return;
        }

        // 技からタグを削除
        this.allTechniques.forEach(technique => {
            if (technique.カテゴリ) {
                technique.カテゴリ = technique.カテゴリ.filter(cat => cat !== tagName);
            }
        });

        // データベースを更新
        if (this.data.技術データベース.基本動作) {
            this.data.技術データベース.基本動作.forEach(technique => {
                if (technique.カテゴリ) {
                    technique.カテゴリ = technique.カテゴリ.filter(cat => cat !== tagName);
                }
            });
        }

        if (this.data.技術データベース.技法) {
            this.data.技術データベース.技法.forEach(technique => {
                if (technique.カテゴリ) {
                    technique.カテゴリ = technique.カテゴリ.filter(cat => cat !== tagName);
                }
            });
        }

        this.extractAllTags();
        this.loadTagManagement();
        this.showSuccess(`タグ「${tagName}」を削除しました。`);
    }

    // データエクスポート・インポート
    exportData(type) {
        let dataToExport;
        let filename;

        switch (type) {
            case 'full':
                dataToExport = this.data;
                filename = 'aikido-full-database.json';
                break;
            case 'techniques':
                dataToExport = {
                    技術データベース: this.data.技術データベース
                };
                filename = 'aikido-techniques.json';
                break;
            case 'backup':
                dataToExport = {
                    ...this.data,
                    exportDate: new Date().toISOString(),
                    exportedBy: this.userInfo ? this.userInfo.email : 'unknown'
                };
                filename = `aikido-backup-${new Date().toISOString().split('T')[0]}.json`;
                break;
        }

        this.downloadJSON(dataToExport, filename);
        this.showSuccess('データをエクスポートしました。');
    }

    downloadJSON(data, filename) {
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    importData() {
        const fileInput = document.getElementById('import-file');
        const file = fileInput.files[0];

        if (!file) {
            this.showError('インポートするファイルを選択してください。');
            return;
        }

        if (!confirm('現在のデータが上書きされます。続行しますか？')) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                this.data = importedData;
                this.extractAllTechniques();
                this.extractAllTags();
                this.loadAdminTechniques();
                this.loadTagManagement();
                this.showSuccess('データをインポートしました。');
            } catch (error) {
                console.error('インポートエラー:', error);
                this.showError('ファイルの読み込みに失敗しました。正しいJSONファイルかご確認ください。');
            }
        };
        reader.readAsText(file);
    }

    // 管理者フィルタリング機能
    applyAdminFilter() {
        const searchText = document.getElementById('admin-search-text').value.trim().toLowerCase();
        const filterType = document.getElementById('admin-filter-type').value;
        const filterCategory = document.getElementById('admin-filter-category').value;
        const filterAttack = document.getElementById('admin-filter-attack').value;

        let filteredTechniques = this.allTechniques.filter(technique => {
            // キーワード検索
            if (searchText) {
                const matchesText = 
                    (technique.名前 && technique.名前.toLowerCase().includes(searchText)) ||
                    (technique.id && technique.id.toLowerCase().includes(searchText)) ||
                    (technique.よみがな && technique.よみがな.toLowerCase().includes(searchText)) ||
                    (technique.説明 && technique.説明.toLowerCase().includes(searchText));
                
                if (!matchesText) return false;
            }

            // 技タイプフィルター
            if (filterType) {
                if (filterType === 'basic' && !technique.id.startsWith('basic_')) return false;
                if (filterType === 'waza' && technique.id.startsWith('basic_')) return false;
            }

            // カテゴリフィルター
            if (filterCategory) {
                const hasMatchingCategory = technique.カテゴリ && 
                    technique.カテゴリ.includes(filterCategory);
                if (!hasMatchingCategory) return false;
            }

            // 攻撃種類フィルター
            if (filterAttack) {
                if (!technique.攻撃 || technique.攻撃 !== filterAttack) return false;
            }

            return true;
        });

        this.displayAdminTechniques(filteredTechniques);
    }

    clearAdminFilter() {
        // フィルター条件をクリア
        document.getElementById('admin-search-text').value = '';
        document.getElementById('admin-filter-type').value = '';
        document.getElementById('admin-filter-category').value = '';
        document.getElementById('admin-filter-attack').value = '';

        // 全技を表示
        this.displayAdminTechniques(this.allTechniques);
    }

    showSuccess(message) {
        // 簡単な成功メッセージ表示
        alert('✓ ' + message);
    }
}

// アプリケーションインスタンスをグローバルに公開（onclick用）
let app;

// DOM読み込み完了後にアプリを初期化
document.addEventListener('DOMContentLoaded', () => {
    app = new AikidoExamApp();
});