export const codeLanguages = [
  {
    value: "javascript",
    label: "JavaScript",
    example: "const greeting = 'Hello, world!';",
  },
  {
    value: "java",
    label: "Java",
    example:
      'public class Hello {\n    public static void main(String[] args) {\n        System.out.println("Hello, world!");\n    }\n}',
  },
  {
    value: "typescript",
    label: "TypeScript",
    example: "const greeting: string = 'Hello, world!';",
  },
  {
    value: "python",
    label: "Python",
    example: 'def greet(name):\n    return f"Hello, {name}!"',
  },
  {
    value: "kotlin",
    label: "Kotlin",
    example: 'fun main() {\n    println("Hello, world!")\n}',
  },
  {
    value: "html",
    label: "HTML",
    example: '<article class="post">Hello, world!</article>',
  },
  { value: "css", label: "CSS", example: ".post {\n  color: #303d35;\n}" },
  {
    value: "sql",
    label: "SQL",
    example: "SELECT title FROM posts WHERE visibility = 'PUBLIC';",
  },
  { value: "json", label: "JSON", example: '{\n  "title": "Hello, world!"\n}' },
  { value: "bash", label: "Shell", example: 'echo "Hello, world!"' },
  { value: "yaml", label: "YAML", example: "server:\n  port: 8080" },
  {
    value: "go",
    label: "Go",
    example: 'func main() {\n    fmt.Println("Hello, world!")\n}',
  },
  {
    value: "rust",
    label: "Rust",
    example: 'fn main() {\n    println!("Hello, world!");\n}',
  },
  {
    value: "cpp",
    label: "C++",
    example: 'int main() {\n    std::cout << "Hello, world!";\n}',
  },
  { value: "plaintext", label: "일반 텍스트", example: "내용을 입력하세요." },
] as const;
