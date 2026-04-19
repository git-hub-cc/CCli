import os
import fnmatch
import sys

def load_ignore_patterns(filepath):
    patterns = []
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    if line.startswith('/'):
                        line = line[1:]
                    patterns.append(line)
    return patterns

def is_ignored(rel_path, ignore_patterns):
    rel_path = rel_path.replace('\\', '/')
    parts = rel_path.split('/')
    
    for pattern in ignore_patterns:
        p = pattern.rstrip('/')
        
        for i in range(len(parts)):
            part_path = '/'.join(parts[i:])
            if fnmatch.fnmatch(part_path, p) or fnmatch.fnmatch(parts[i], p):
                return True

        if fnmatch.fnmatch(rel_path, p) or fnmatch.fnmatch(rel_path, f"*/{p}") or fnmatch.fnmatch(rel_path, f"{p}/*"):
            return True
            
    return False

def main():
    cwd = os.getcwd()
    
    ignore_patterns = ['.git', '.ccli', 'node_modules', 'dist', '__pycache__']
    ignore_patterns.extend(load_ignore_patterns(os.path.join(cwd, '.gitignore')))
    ignore_patterns.extend(load_ignore_patterns(os.path.join(cwd, '.llmignore')))

    valid_files = []
    
    for root, dirs, files in os.walk(cwd):
        dirs[:] = [d for d in dirs if not is_ignored(os.path.relpath(os.path.join(root, d), cwd), ignore_patterns)]
        
        for file in files:
            rel_path = os.path.relpath(os.path.join(root, file), cwd)
            if not is_ignored(rel_path, ignore_patterns):
                valid_files.append(rel_path.replace('\\', '/'))

    # 强制将输出流编码设置为 UTF-8 以解决跨进程乱码问题
    sys.stdout.reconfigure(encoding='utf-8')

    if not valid_files:
        print("【系统自动反馈：扫描结果】\n当前目录下没有发现可用文件，或全部被 ignore 规则屏蔽。")
        return

    valid_files.sort()
    file_list_str = "\n".join(f"- {f}" for f in valid_files)
    
    print("【系统自动反馈：项目结构扫描结果】")
    print("已过滤掉忽略配置中的条目，当前项目的有效文件结构如下：\n")
    print(file_list_str)
    print("\n（提示：如需查看某个文件的详细代码，请使用 `<upload path=\"相对路径\" />` 指令）")

if __name__ == "__main__":
    main()