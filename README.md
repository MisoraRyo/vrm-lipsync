# VRM Lipsync Demo

Three.js と Web Audio API を使用して、VRM モデルの口を音声に合わせてリップシンクさせるデモアプリケーションです。

## 機能

- **リップシンク**: 音声の周波数分析を使用してVRMモデルの口の動きを制御
- **複数モデル対応**: サンプルVRMモデルを複数用意
- **音声アニメーション**: 複数の音声ファイルに対応
- **モーションアニメーション**: VRM Animation (`.vrma`) ファイル対応

## セットアップ

### 要件

- Node.js 18 以上
- npm または yarn

### インストール

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev
```

### VRMモデルの追加

VRMモデルがない場合は、以下の手順で追加してください：

1. VRMモデルファイル（`.vrm`）を用意します
2. `public/model/` ディレクトリにコピーします
3. アプリケーション内で参照してください

**サンプルディレクトリ構造:**
```
public/model/
├── AvatarSample_A.vrm
├── AvatarSample_Y.vrm
└── AvatarSample_Y2.vrm
```

## 音声ファイルの追加

音声ファイル（MP3など）は `public/voice/` ディレクトリに配置してください。

## モーションファイルの追加

VRM Animation ファイル（`.vrma`）は `public/motion/` ディレクトリに配置してください。

## 技術スタック

- **Three.js**: 3Dモデルレンダリング
- **@pixiv/three-vrm**: VRMモデルローダー
- **Web Audio API**: 音声周波数分析
- **TypeScript**: 型安全な開発

## 仕組み

このアプリケーションは以下の処理を行っています：

1. **周波数分析**: `AnalyserNode.getByteFrequencyData()` で音声の周波数スペクトラムを取得
2. **フォルマント推定**: 周波数データからフォルマント（音声の特性周波数）を推定
3. **リップシンク制御**: 推定されたフォルマントに基づいてVRMの口の表現を制御

## ライセンス

MIT License

詳細は [LICENSE](LICENSE) ファイルを参照してください。

## 参考資料

- [VRM Specification](https://vrm.dev/)
- [Three.js Documentation](https://threejs.org/docs/)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
