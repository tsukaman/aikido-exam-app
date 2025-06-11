class AikidoExamApp {
    constructor() {
        this.data = null;
        this.currentExamData = null;
        this.speechSynthesis = window.speechSynthesis;
        this.currentUtterance = null;
        this.isLoading = false;
        this.currentMode = 'exam'; // 'search', 'exam' - 初期表示は審査支援
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
            
            // 同意状態をチェック
            if (!this.checkAgreement()) {
                // 同意していない場合はランディングページを表示
                this.showLandingPage();
                return;
            }
            
            // 同意済みの場合はアプリを初期化
            this.hideLandingPage();
            await this.initializeApp();
        } catch (error) {
            console.error('初期化エラー:', error);
            this.showError('アプリケーションの初期化に失敗しました。');
        }
    }
    
    async initializeApp() {
        // データ読み込みとアプリ初期化
        await this.loadData();
        this.extractAllTechniques();
        this.extractAllTags();
        this.setupEventListeners();
        this.populateExamCategories();
        this.setupModeSwitch();
        this.showMainApp();
        
        // 初期表示を審査支援モードに設定
        this.switchMode('exam');
        console.log('アプリ初期化完了 - 審査支援モードで開始');
    }
    
    checkAgreement() {
        // セッションストレージから同意状態を確認
        return sessionStorage.getItem('aikido-app-agreed') === 'true';
    }
    
    showLandingPage() {
        // ランディングページを表示
        document.getElementById('landing-page').style.display = 'flex';
        document.querySelector('.container').style.display = 'none';
        
        // イベントリスナーを設定
        const checkbox = document.getElementById('agree-checkbox');
        const enterBtn = document.getElementById('enter-app-btn');
        
        checkbox.addEventListener('change', (e) => {
            enterBtn.disabled = !e.target.checked;
        });
        
        enterBtn.addEventListener('click', async () => {
            if (checkbox.checked) {
                // 同意状態を保存
                sessionStorage.setItem('aikido-app-agreed', 'true');
                // ランディングページを非表示にしてアプリを初期化
                this.hideLandingPage();
                await this.initializeApp();
            }
        });
    }
    
    hideLandingPage() {
        document.getElementById('landing-page').style.display = 'none';
        document.querySelector('.container').style.display = 'block';
    }

    async loadData() {
        try {
            // GitHub Pagesとローカル環境の両方で動作するようにパスを調整
            const basePath = window.location.pathname.includes('/aikido-exam-app/') 
                ? '/aikido-exam-app' 
                : '';
            const dataPath = basePath ? `${basePath}/data/aikido-ryu-exam-db.json` : './data/aikido-ryu-exam-db.json';
            
            const response = await fetch(dataPath);
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
        const showAllSubjectsBtn = document.getElementById('show-all-subjects-btn');
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

        showAllSubjectsBtn.addEventListener('click', () => {
            this.showAllTechniques();
            this.updateButtonVisibility(false);
        });

        showDesignatedBtn.addEventListener('click', () => {
            this.showDesignatedTechniques();
            this.updateButtonVisibility(true);
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
                    // 技IDがない場合（指定技や自由技など）
                    const techniqueName = examTechniqueItem.querySelector('.exam-technique-name').textContent;
                    const reading = examTechniqueItem.querySelector('.exam-technique-reading').textContent;
                    
                    if (techniqueName === '指定技' || techniqueName.includes('指定技')) {
                        // 指定技の場合は指定技リストを表示
                        this.showDesignatedTechniques();
                    } else {
                        // その他の場合は音声読み上げ
                        this.speakTechnique(techniqueName, reading);
                    }
                }
            }
        });

        // 認証関連のイベントリスナーは削除（Auth0関連コードを削除したため）

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
        console.log('=== onExamCategoryChange 開始 ===');
        const examCategory = document.getElementById('exam-category').value;
        const gradeSelection = document.getElementById('grade-selection');
        const gradeSelect = document.getElementById('grade');
        const techniqueSection = document.getElementById('technique-section');

        console.log('選択された審査区分:', examCategory);
        console.log('データの審査区分:', this.data ? Object.keys(this.data.審査区分) : 'データなし');

        if (!examCategory) {
            console.log('審査区分が選択されていません');
            gradeSelection.style.display = 'none';
            techniqueSection.style.display = 'none';
            return;
        }

        // 級・段の選択肢をクリア
        gradeSelect.innerHTML = '<option value="">選択してください</option>';

        // 選択された審査区分の級・段を取得
        const examData = this.data.審査区分[examCategory];
        console.log('取得した審査データ:', examData);
        
        if (examData) {
            const grades = Object.keys(examData);
            console.log('利用可能な級・段:', grades);
            
            grades.forEach(grade => {
                const option = document.createElement('option');
                option.value = grade;
                option.textContent = grade;
                gradeSelect.appendChild(option);
            });
            gradeSelection.style.display = 'block';
            
        } else {
            console.log('審査データが見つかりません');
        }

        // 技術セクションを非表示にする
        console.log('技術セクションを非表示にします');
        techniqueSection.style.display = 'none';
        console.log('=== onExamCategoryChange 終了 ===');
    }

    onGradeChange() {
        console.log('=== onGradeChange 開始 ===');
        const examCategory = document.getElementById('exam-category').value;
        const grade = document.getElementById('grade').value;
        const techniqueSection = document.getElementById('technique-section');

        console.log('onGradeChange called:', { examCategory, grade });
        console.log('techniqueSection要素:', techniqueSection);

        if (!examCategory || !grade) {
            console.log('審査区分または級・段が選択されていません');
            techniqueSection.style.display = 'none';
            return;
        }

        // 選択された級・段の審査データを取得
        console.log('審査データ取得中:', examCategory, grade);
        console.log('this.data.審査区分[examCategory]:', this.data.審査区分[examCategory]);
        
        this.currentExamData = this.data.審査区分[examCategory][grade];
        
        console.log('currentExamData:', this.currentExamData);
        console.log('科目データ:', this.currentExamData ? this.currentExamData.科目 : 'なし');
        console.log('指定技データ:', this.currentExamData ? this.currentExamData.指定技 : 'なし');
        
        // 指定技が科目に含まれているかチェック
        if (this.currentExamData && this.currentExamData.科目) {
            const hasDesignatedTechnique = this.currentExamData.科目.includes('指定技');
            console.log('科目に「指定技」が含まれているか:', hasDesignatedTechnique);
        }
        
        if (this.currentExamData && this.currentExamData.科目) {
            console.log('=== 技リストを表示開始 ===');
            console.log('科目数:', this.currentExamData.科目.length);
            console.log('科目内容:', this.currentExamData.科目);
            
            console.log('techniqueSection表示前:', techniqueSection.style.display);
            techniqueSection.style.display = 'block';
            console.log('techniqueSection表示後:', techniqueSection.style.display);
            
            this.clearTechniqueDisplay();
            this.updateDesignatedTechniqueButton();
            this.updateButtonVisibility(false);
            
            console.log('showAllTechniques呼び出し開始');
            this.showAllTechniques();
            console.log('showAllTechniques呼び出し完了');
        } else {
            console.log('審査データまたは科目データが見つかりません');
            console.log('this.currentExamData:', this.currentExamData);
            if (this.currentExamData) {
                console.log('科目プロパティ:', Object.keys(this.currentExamData));
            }
            techniqueSection.style.display = 'none';
        }
        console.log('=== onGradeChange 終了 ===');
    }

    updateButtonVisibility(isDesignatedView) {
        const showAllSubjectsBtn = document.getElementById('show-all-subjects-btn');
        const showDesignatedBtn = document.getElementById('show-designated-btn');
        const sequentialReadingBtn = document.getElementById('sequential-reading-btn');
        
        if (isDesignatedView) {
            // 指定技表示中
            showAllSubjectsBtn.style.display = 'inline-block';
            showDesignatedBtn.style.display = 'none';
            sequentialReadingBtn.style.display = 'none';
        } else {
            // 全科目表示中
            showAllSubjectsBtn.style.display = 'none';
            if (this.currentExamData && this.currentExamData.指定技) {
                showDesignatedBtn.style.display = 'inline-block';
                sequentialReadingBtn.style.display = 'none';
            } else {
                showDesignatedBtn.style.display = 'none';
                sequentialReadingBtn.style.display = 'inline-block';
            }
        }
    }

    showAllTechniques() {
        console.log('=== showAllTechniques 開始 ===');
        console.log('currentExamData:', this.currentExamData);
        
        if (!this.currentExamData || !this.currentExamData.科目) {
            console.error('審査科目データが見つかりません', this.currentExamData);
            this.showError('審査科目データが見つかりません。');
            return;
        }

        console.log('科目データ:', this.currentExamData.科目);

        const techniqueList = document.getElementById('technique-list');
        const randomTechnique = document.getElementById('random-technique');
        
        console.log('technique-list要素:', techniqueList);
        console.log('random-technique要素:', randomTechnique);
        
        if (!techniqueList) {
            console.error('technique-list要素が見つかりません');
            console.error('DOM要素の確認:', {
                'technique-section': document.getElementById('technique-section'),
                'technique-list': document.getElementById('technique-list'),
                'exam-category': document.getElementById('exam-category'),
                'grade': document.getElementById('grade')
            });
            return;
        }
        
        randomTechnique.style.display = 'none';
        techniqueList.innerHTML = '';
        console.log('techniqueListをクリアしました');

        // 補足情報を表示
        console.log('補足情報を表示中');
        this.displaySupplementaryInfo();

        // 審査支援ではリスト表示用のクラスを適用
        techniqueList.className = 'exam-technique-list';
        console.log('クラス名を設定:', techniqueList.className);

        console.log('技の表示を開始:', this.currentExamData.科目.length, '件');

        // JSONデータの順番通りに技を表示（指定技や自由技も含む）
        this.currentExamData.科目.forEach((item, index) => {
            console.log(`技 ${index + 1} 作成中:`, item);
            const techniqueElement = this.createExamTechniqueElement(item);
            console.log(`技 ${index + 1} 要素:`, techniqueElement);
            techniqueList.appendChild(techniqueElement);
            console.log(`技 ${index + 1} 追加完了`);
        });
        
        console.log('技の表示完了');
        console.log('最終的なtechniqueList.children.length:', techniqueList.children.length);
        console.log('最終的なtechniqueList.innerHTML:', techniqueList.innerHTML.substring(0, 200) + '...');
        console.log('=== showAllTechniques 終了 ===');
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

        // 指定技を表示（リスト形式）- フィルタリングを削除して全ての指定技を表示
        techniqueList.className = 'exam-technique-list';
        
        designatedTechniques.forEach((technique) => {
            const techniqueElement = this.createExamTechniqueElement(technique.id);
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

        // フィルタリングを削除して全ての指定技からランダム選択
        const randomIndex = Math.floor(Math.random() * designatedTechniques.length);
        const selectedTechnique = designatedTechniques[randomIndex];

        this.displayRandomTechnique(selectedTechnique);
        this.speakTechnique(selectedTechnique.名前, selectedTechnique.よみがな);
    }

    getDesignatedTechniques() {
        if (!this.currentExamData || !this.currentExamData.指定技) {
            return [];
        }

        const designatedTechniques = [];
        const designatedList = this.currentExamData.指定技;

        if (Array.isArray(designatedList)) {
            // 指定技が配列の場合（技IDのリスト）
            designatedList.forEach(techniqueId => {
                const technique = this.allTechniques.find(t => t.id === techniqueId);
                if (technique) {
                    designatedTechniques.push(technique);
                } else {
                    console.warn(`指定技 "${techniqueId}" が見つかりません`);
                }
            });
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
        
        // 指定技が設定されているかチェック
        if (this.currentExamData && this.currentExamData.指定技) {
            // 指定技の数を計算（フィルタリングなしで全件数を表示）
            const designatedTechniques = this.getDesignatedTechniques();
            const totalCount = designatedTechniques.length;
            
            // 指定技関連ボタンを表示
            if (randomDesignatedBtn) {
                randomDesignatedBtn.style.display = 'inline-block';
                randomDesignatedBtn.textContent = `指定技ランダム (${totalCount}件)`;
            }
            
            if (showDesignatedBtn) {
                showDesignatedBtn.style.display = 'inline-block';
                showDesignatedBtn.textContent = `指定技のみ表示 (${totalCount}件)`;
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

    createExamTechniqueElement(techniqueId) {
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

        if (techniqueId.includes('指定技')) {
            // 指定技の場合
            displayName = techniqueId;
            reading = '';
            description = 'この審査区分の指定技範囲からランダムに選択されます';
        } else if (techniqueId.includes('自由技')) {
            // 自由技の場合
            displayName = techniqueId;
            reading = '';
            description = '相手の攻撃に対して自由に技を選択して行います';
        } else {
            // 通常の技の場合
            const technique = this.allTechniques.find(t => t.id === techniqueId);
            if (technique) {
                displayName = technique.名前;
                reading = technique.よみがな || '';
                description = technique.説明 || '';
                categories = technique.カテゴリ ? technique.カテゴリ.join('・') : '';
            } else {
                // 技データが見つからない場合
                displayName = techniqueId;
                reading = '';
                description = '技の詳細情報が設定されていません';
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