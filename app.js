class AikidoExamApp {
    constructor() {
        this.data = null;
        this.currentExamData = null;
        this.speechSynthesis = window.speechSynthesis;
        this.currentUtterance = null;
        this.isLoading = false;
        this.currentMode = 'search'; // 'search', 'exam'
        this.allTechniques = []; // 全技術データを格納
        this.currentEditingTechnique = null;
        this.allTags = new Set(); // 全タグを格納
        this.sequentialReading = {
            isActive: false,
            currentIndex: 0,
            techniqueIds: [],
            timeoutId: null
        }; // 順次読み上げ用の状態
        
        this.init();
    }

    async init() {
        try {
            console.log('アプリ初期化開始...');
            
            // データ読み込みとアプリ初期化
            await this.loadData();
            this.extractAllTechniques();
            this.extractAllTags();
            this.setupEventListeners();
            this.populateExamCategories();
            this.setupModeSwitch();
            this.showMainApp();
            console.log('アプリ初期化完了');
        } catch (error) {
            console.error('初期化エラー:', error);
            this.showError('アプリケーションの初期化に失敗しました。');
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

    populateExamCategories() {
        // 審査区分データが存在することを確認
        if (!this.data || !this.data.審査区分) {
            console.error('審査区分データが見つかりません');
            return;
        }
        
        // すでにオプションが設定されているので、追加処理は不要
    }

    showMainApp() {
        // メインコンテンツを表示
        document.querySelector('main').style.display = 'flex';
        
        // タブコンテナを表示
        document.querySelector('.mode-tabs').style.display = 'flex';
    }

    setupModeSwitch() {
        const searchModeTab = document.getElementById('search-mode-tab');
        const examModeTab = document.getElementById('exam-mode-tab');
        
        searchModeTab.addEventListener('click', () => {
            this.switchMode('search');
        });
        
        examModeTab.addEventListener('click', () => {
            this.switchMode('exam');
        });
    }

    switchMode(mode) {
        this.currentMode = mode;
        
        const searchMode = document.getElementById('search-mode');
        const examMode = document.getElementById('exam-mode');
        const searchModeTab = document.getElementById('search-mode-tab');
        const examModeTab = document.getElementById('exam-mode-tab');
        
        // すべて非表示
        [searchMode, examMode].forEach(el => {
            if (el) el.style.display = 'none';
        });
        
        // すべてのタブを非アクティブ
        [searchModeTab, examModeTab].forEach(el => {
            if (el) el.classList.remove('active');
        });
        
        // 選択されたモードを表示
        if (mode === 'search') {
            searchMode.style.display = 'block';
            searchModeTab.classList.add('active');
        } else if (mode === 'exam') {
            examMode.style.display = 'block';
            examModeTab.classList.add('active');
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

        // 表示切替トグルのイベントリスナー（検索モードのみ）
        this.setupViewToggleListeners();

        // モーダル関連のイベントリスナー
        this.setupModalListeners();

        // 音声設定のイベントリスナー
        this.setupSpeechSettingsListeners();
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

    // 以下、既存のメソッドは省略（審査支援、検索機能など）
    // 必要な分だけ残します

    showError(message) {
        // 簡単なエラー表示
        alert(message);
    }

    showSuccess(message) {
        // 簡単な成功メッセージ表示
        alert('✓ ' + message);
    }
}

// アプリケーションインスタンスをグローバルに公開
let app;

// DOM読み込み完了後にアプリを初期化
document.addEventListener('DOMContentLoaded', () => {
    app = new AikidoExamApp();
});