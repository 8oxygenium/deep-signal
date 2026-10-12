# DECISIONS（判断の記録）

迷ったときに選んだ方を1行ずつ記録する。

## フェーズ1：準備
- サイトは Cloudflare Pages がリポジトリ直下をビルドなしでそのまま配信する構成（package.json・ビルド設定ファイルが無い）と判断。コミットしたファイルは全部公開される前提で設定した。
- `node_modules/`・`dist/`・`dist-electron/`・`release/`・`*.exe`・テスト出力は、プロトタイプ内とリポジトリ直下の両方の `.gitignore` で除外（二重の保険）。
- ソース置き場 `games/hansode-pinball-prototype/` は `_headers` で noindex、さらに `_redirects` でダウンロードページへ302転送し、Webで「遊べる版」が見えないようにした（Cloudflare Pages の `_redirects` は1パターンにスプラット1つまでなので個別指定）。
- three.js は Vite がバンドルするので devDependencies に置き、インストーラーへ二重に入らないようにした。実行時に必要なのは koffi だけ。
- koffi は Windows x64 用バイナリだけ同梱し、ネイティブ部分は asarUnpack で asar の外に出す（asar 内の .node は読めないため）。
- インストーラーに入れる言語パックは ja / en-US のみ（約45MB削減）。
- 固定キーに加えて「フィルターキー（右Shift 8秒長押し）」「切り替えキー（NumLock 5秒）」のショートカットも同じ手法で無効化する。フリッパーで右Shiftを長押しするとフィルターキーの確認が出てしまうため。
- 固定キー等の変更は fWinIni=0（レジストリに保存しない）で行う。異常終了しても次回ログオンで必ず元に戻り、さらに userData のバックアップから次回起動時にも復元する。
- 固定キー等の無効化は「ウィンドウにフォーカスがある間」だけ。他のアプリに切り替えたらユーザー本来の設定に戻す。
- ユーザーが固定キー機能そのものを ON にして使っている場合は触らない（Microsoft推奨どおり）。
- Windows で左右Shift同時押し中に片方を離すと keyup が届かないことがあるため、メインプロセスで GetAsyncKeyState を4msごとに読む保険を付けた。
- TypeScript は 7.0（ネイティブ版）ではなく安定している 5.9 系を使う。
- `gh`（GitHub CLI）がこのPCに入っていないため、GitHub Releases へのアップロードは `npm run release` で gh があれば自動、無ければ `リリース手順.md` の手順で行う形にした。
