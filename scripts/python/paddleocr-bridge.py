import sys
import json
import argparse
import subprocess
import os

def ensure_dependencies():
    try:
        import paddleocr
    except ImportError:
        print(json.dumps({"status": "info", "message": "正在自动安装依赖 paddlepaddle 和 paddleocr..."}), file=sys.stderr)
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "paddlepaddle", "paddleocr>=2.0.1"], stdout=subprocess.DEVNULL)
        except subprocess.CalledProcessError as e:
            print(json.dumps({"status": "error", "message": f"自动安装依赖失败: {e}"}), file=sys.stderr)
            sys.exit(1)

ensure_dependencies()

from paddleocr import PaddleOCR

def get_y(line):
    return sum([pt[1] for pt in line[0]]) / 4

def get_x(line):
    return sum([pt[0] for pt in line[0]]) / 4

def get_h(line):
    pts = line[0]
    return ((pts[2][1] + pts[3][1]) / 2) - ((pts[0][1] + pts[1][1]) / 2)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("img_path", help="截图绝对路径")
    parser.add_argument("model_dir", help="本地模型存放目录")
    
    args = parser.parse_args()

    det_dir = os.path.join(args.model_dir, 'det')
    rec_dir = os.path.join(args.model_dir, 'rec')
    cls_dir = os.path.join(args.model_dir, 'cls')

    # 初始化并拦截日志输出
    ocr = PaddleOCR(
        use_angle_cls=True, 
        lang="ch", 
        show_log=False, 
        det_model_dir=det_dir, 
        rec_model_dir=rec_dir, 
        cls_model_dir=cls_dir
    )
    
    result = ocr.ocr(args.img_path, cls=True)
    
    if not result or not result[0]:
        print("")
        return

    lines = result[0]
    
    # 按照纵向 Y 坐标进行整体初排
    lines.sort(key=lambda x: get_y(x))
    
    grouped_lines = []
    current_line = []
    current_y = None
    
    # 将同一水平线上的元素划分为同一行，还原表格与多栏排版
    for line in lines:
        y = get_y(line)
        h = get_h(line)
        threshold = h * 0.5 if h > 0 else 10
        
        if current_y is None:
            current_y = y
            current_line.append(line)
        elif abs(y - current_y) < threshold:
            current_line.append(line)
            current_y = sum([get_y(l) for l in current_line]) / len(current_line)
        else:
            current_line.sort(key=lambda x: get_x(x))
            grouped_lines.append(current_line)
            current_line = [line]
            current_y = y
            
    if current_line:
        current_line.sort(key=lambda x: get_x(x))
        grouped_lines.append(current_line)

    final_text = []
    for group in grouped_lines:
        texts = [item[1][0] for item in group]
        final_text.append("    ".join(texts))
    
    print("\n".join(final_text))

if __name__ == "__main__":
    main()