import sys
import subprocess

def get_app_association():
    sys.stdout.reconfigure(encoding='utf-8')
    if len(sys.argv) < 2 or not sys.argv[1].strip():
        print("【执行异常】参数不足！请提供需要查询的文件扩展名 (例如 .pdf, .png, .py)。")
        return
    
    ext = sys.argv[1].strip().lower()
    if not ext.startswith('.'):
        ext = '.' + ext
        
    try:
        # 1. 使用 Windows 原生 assoc 工具查找文件类型标识
        assoc_result = subprocess.check_output(['cmd', '/c', f'assoc {ext}'], text=True, stderr=subprocess.STDOUT)
        file_type = assoc_result.strip().split('=')[1]
        
        # 2. 使用 ftype 查找对应的打开命令
        ftype_result = subprocess.check_output(['cmd', '/c', f'ftype {file_type}'], text=True, stderr=subprocess.STDOUT)
        open_command = ftype_result.strip().split('=')[1]
        
        print(f"【系统自动反馈：默认应用关联状态】")
        print(f"查询扩展名: {ext}")
        print(f"注册表类型: {file_type}")
        print(f"默认执行链: {open_command}")
        
    except subprocess.CalledProcessError:
        print(f"【系统自动反馈】系统中未能找到扩展名 '{ext}' 的默认关联程序，或者该类型未在注册表中登记。")
    except Exception as e:
        print(f"【执行异常】查询文件关联与 MIME 状态失败: {e}")

if __name__ == '__main__':
    get_app_association()