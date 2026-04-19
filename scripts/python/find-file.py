import sys
import os

def find_file():
    sys.stdout.reconfigure(encoding='utf-8')
    if len(sys.argv) < 2 or not sys.argv[1].strip():
        print("【执行异常】参数不足！请提供要搜索的文件名或关键词。")
        return
    
    target_filename = sys.argv[1].strip().lower()
    search_dir = sys.argv[2].strip() if len(sys.argv) > 2 and sys.argv[2].strip() else os.path.expanduser('~')
    
    print(f"【系统自动反馈】正在目录 '{search_dir}' 中向下深度搜索 '{target_filename}'，请稍候...")
    
    found_paths = []
    # 限制搜索深度与忽略高频缓存目录，防止卡死
    ignore_dirs = {'node_modules', '.git', 'AppData', 'Local Settings', 'Application Data', '__pycache__', '.cache'}
    
    try:
        for root, dirs, files in os.walk(search_dir):
            # 动态移除不需要遍历的目录
            dirs[:] = [d for d in dirs if d not in ignore_dirs]
            
            for file in files:
                if target_filename in file.lower():
                    found_paths.append(os.path.join(root, file))
                    if len(found_paths) >= 20:
                        break
            if len(found_paths) >= 20:
                break
        
        if not found_paths:
            print(f"【搜索结果】在目标区域未找到名称包含 '{target_filename}' 的文件。")
            return
        
        print(f"【搜索结果: 找到 {len(found_paths)} 个高度匹配项】")
        for path in found_paths:
            print(f"-> {path}")
            
        if len(found_paths) >= 20:
            print("... (结果已截断，仅展示前 20 项匹配记录)")
            
    except Exception as e:
        print(f"【执行异常】搜索过程中发生权限或系统错误: {e}")

if __name__ == '__main__':
    find_file()