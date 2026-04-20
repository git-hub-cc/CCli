import sys
import os
import fnmatch

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

def is_binary_file(filepath):
    text_exts = ['.md', '.txt', '.js', '.ts', '.json', '.py', '.html', '.css', '.vue', '.java', '.c', '.cpp', '.h', '.xml', '.yml', '.yaml', '.sh', '.bat', '.ps1', '.ahk', '.env']
    _, ext = os.path.splitext(filepath)
    if ext.lower() in text_exts:
        return False
    try:
        with open(filepath, 'rb') as f:
            chunk = f.read(512)
            if b'\0' in chunk:
                return True
    except Exception:
        return True
    return False

def main():
    if len(sys.argv) < 2:
        print("【系统自动反馈：打包失败】缺少文件或目录路径参数。")
        return

    sys.stdout.reconfigure(encoding='utf-8')

    files_attr = sys.argv[1]
    path_list = [p.strip() for p in files_attr.split(',') if p.strip()]
    
    if not path_list:
        print("【系统自动反馈：打包失败】路径列表为空。")
        return

    cwd = os.getcwd()
    ignore_patterns = ['.git', '.ccli', 'node_modules', 'dist', '__pycache__']
    ignore_patterns.extend(load_ignore_patterns(os.path.join(cwd, '.gitignore')))
    ignore_patterns.extend(load_ignore_patterns(os.path.join(cwd, '.llmignore')))

    valid_files = []
    ignored_count = 0
    binary_count = 0

    for raw_path in path_list:
        abs_path = raw_path if os.path.isabs(raw_path) else os.path.abspath(os.path.join(cwd, raw_path))
        
        if not os.path.exists(abs_path):
            continue

        if os.path.isfile(abs_path):
            rel_path = os.path.relpath(abs_path, cwd).replace('\\', '/')
            if is_ignored(rel_path, ignore_patterns):
                ignored_count += 1
            elif is_binary_file(abs_path):
                binary_count += 1
            else:
                valid_files.append(abs_path)
        elif os.path.isdir(abs_path):
            for root, dirs, files in os.walk(abs_path):
                rel_root = os.path.relpath(root, cwd).replace('\\', '/')
                if rel_root == '.':
                    rel_root = ''
                
                next_dirs = []
                for d in dirs:
                    rel_d = f"{rel_root}/{d}".strip('/')
                    if is_ignored(rel_d, ignore_patterns):
                        ignored_count += 1
                    else:
                        next_dirs.append(d)
                dirs[:] = next_dirs

                for f in files:
                    rel_f = f"{rel_root}/{f}".strip('/')
                    f_abs = os.path.join(root, f)
                    if is_ignored(rel_f, ignore_patterns):
                        ignored_count += 1
                    elif is_binary_file(f_abs):
                        binary_count += 1
                    else:
                        valid_files.append(f_abs)

    if not valid_files:
        print(f"【系统自动反馈：打包失败】未找到有效的文本文件。过滤项: {ignored_count}, 跳过二进制: {binary_count}。")
        return

    merged_content = ""
    res_file_path = os.path.join(cwd, 'res.md')

    for abs_path in valid_files:
        rel_path = os.path.relpath(abs_path, cwd)
        _, ext = os.path.splitext(abs_path)
        ext = ext.lstrip('.') if ext else 'text'

        try:
            with open(abs_path, 'r', encoding='utf-8') as f:
                file_raw_content = f.read()
            merged_content += f"## 📄 文件: {rel_path}\n\n"
            merged_content += f"```{ext}\n{file_raw_content}\n```\n\n---\n\n"
        except Exception as e:
            merged_content += f"## 📄 文件: {rel_path} (读取失败)\n\n> 系统提示：无法读取文件内容 ({e})。\n\n---\n\n"

    try:
        with open(res_file_path, 'w', encoding='utf-8') as f:
            f.write(merged_content)
        
        print(f"【系统自动反馈：批量打包成功】\n共提取 {len(valid_files)} 个文本文件，过滤屏蔽 {ignored_count} 项，跳过二进制 {binary_count} 项。\n已将内容合并至 `res.md`，准备执行挂载指令。")
    except Exception as e:
        print(f"【系统自动反馈：打包写入失败】{e}")

if __name__ == "__main__":
    main()