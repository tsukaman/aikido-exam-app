// アプリケーション設定ファイルのサンプル
// 使用方法：
// 1. このファイルを config.js にコピー
// 2. 必要に応じて設定を変更

const CONFIG = {
    // アプリケーション設定
    appSettings: {
        enableDebugMode: false,
        maxTechniques: 1000,
        defaultSpeechRate: 0.8
    }
};

// グローバルに公開
window.APP_CONFIG = CONFIG;