import sys
import os

def main():
    if len(sys.argv) < 2:
        print("【系统自动反馈：打包失败】缺少文件列表参数。")
        return

    sys.stdout.reconfigure(encoding='utf-8')

    files_attr = sys.argv[1]
    file_list = [f.strip() for f in files_attr.split(',') if f.strip()]
    
    if not file_list:
        print("【系统自动反馈：打包失败】文件列表为空。")
        return

    merged_content = ""
    cwd = os.getcwd()
    res_file_path = os.path.join(cwd, 'res.md')

    for rel_path in file_list:
        abs_path = rel_path if os.path.isabs(rel_path) else os.path.join(cwd, rel_path)
        
        _, ext = os.path.splitext(abs_path)
        ext = ext.lstrip('.') if ext else 'text'

        if os.path.exists(abs_path) and os.path.isfile(abs_path):
            try:
                with open(abs_path, 'r', encoding='utf-8') as f:
                    file_raw_content = f.read()
                merged_content += f"## 📄 文件: {rel_path}\n\n"
                merged_content += f"```{ext}\n{file_raw_content}\n```\n\n---\n\n"
            except Exception as e:
                merged_content += f"## 📄 文件: {rel_path} (读取失败)\n\n> 系统提示：无法读取文件内容 ({e})。\n\n---\n\n"
        else:
            merged_content += f"## 📄 文件: {rel_path} (读取失败)\n\n> 系统提示：该文件不存在或不是合法文件。\n\n---\n\n"

    try:
        with open(res_file_path, 'w', encoding='utf-8') as f:
            f.write(merged_content)
        
        print(f"【系统自动反馈：批量打包成功】\n已将 {len(file_list)} 个文件的内容合并至 `res.md`，准备执行挂载指令。")
    except Exception as e:
        print(f"【系统自动反馈：打包写入失败】{e}")

if __name__ == "__main__":
    main()