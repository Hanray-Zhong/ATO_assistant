# 决战版图素材

把两张图片放在这个目录：

- `battle-board.jpg`：第二屏使用的原图。
- `battle-board.jpg.preview.jpg`：AIBP 使用的缩略图。

资料包导出会自动生成缩略图。在源码目录添加或替换原图后，运行
`python tools/generate_aibp_previews.py` 更新缩略图（需要 Pillow）。

Docker 只需挂载 `./app/ss/battle-board:/app/ss/battle-board:ro`。
图片由使用者自行提供，不包含在公开镜像或源码中。
