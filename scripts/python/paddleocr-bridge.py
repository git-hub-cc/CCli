import sys
import os
import json
import subprocess
import base64
from io import BytesIO

def ensure_dependencies():
    missing_deps = []
    try:
        import paddleocr
    except ImportError:
        missing_deps.append('paddleocr>=2.0.1')

    try:
        import paddle
    except ImportError:
        missing_deps.append('paddlepaddle')

    try:
        from PIL import Image
    except ImportError:
        missing_deps.append('Pillow')

    if missing_deps:
        print(json.dumps({
            "status": "info",
            "message": f"正在首次初始化视觉环境，自动安装依赖: {', '.join(missing_deps)}，请稍候..."
        }), flush=True)
        try:
            subprocess.check_call([sys.executable, '-m', 'pip', 'install'] + missing_deps)
            # 强制刷新缓存库
            import site
            from importlib import reload
            reload(site)
        except Exception as e:
            print(json.dumps({
                "status": "error",
                "message": f"依赖安装失败，请手动执行 pip install {' '.join(missing_deps)}。错误信息: {str(e)}"
            }))
            sys.exit(1)

def main():
    try:
        ensure_dependencies()

        from paddleocr import PaddleOCR
        from PIL import Image
        import numpy as np

        if len(sys.argv) < 2:
            print(json.dumps({"status": "error", "message": "Missing image path or base64 argument"}))
            sys.exit(1)

        image_input = sys.argv[1]

        if image_input.startswith('base64,'):
            img_data = base64.b64decode(image_input.split(',')[1])
            img = Image.open(BytesIO(img_data)).convert('RGB')
            img_array = np.array(img)
        else:
            if not os.path.exists(image_input):
                print(json.dumps({"status": "error", "message": f"Image file not found: {image_input}"}))
                sys.exit(1)
            img = Image.open(image_input).convert('RGB')
            img_array = np.array(img)

        ocr = PaddleOCR(use_angle_cls=True, lang='ch', show_log=False)
        result = ocr.ocr(img_array, cls=True)

        texts = []
        if result and result[0]:
            for line in result[0]:
                box = line[0]
                text = line[1][0]
                confidence = line[1][1]
                texts.append({
                    "text": text,
                    "box": box,
                    "confidence": float(confidence)
                })

        print(json.dumps({
            "status": "success",
            "data": texts
        }, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({
            "status": "error",
            "message": str(e)
        }, ensure_ascii=False))
        sys.exit(1)

if __name__ == '__main__':
    main()