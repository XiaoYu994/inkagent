# 错误处理

> 错误处理很重要，但如果它搞乱了逻辑，就是错的。错误处理应当被打包隔离，让主流程在读了以后一眼看出"这里只做这一件事"。

**何时阅读：** 抛错、捕获、返回错误，或处理空值/缺省之前。加载协议见仓库根目录 [AGENTS.md](../../AGENTS.md)。

## 1. 用异常替代返回码

- 返回错误码会把"处理错误"的责任推到每个调用点，且容易忘记检查：

```text
// 差：每个调用者都要面对 if
if (deletePage(page) == E_OK) {
    if (registry.delete(reference) == E_OK) { ... }
}

// 好：快乐路径与失败路径分离
try {
    deletePage(page);
    registry.delete(reference);
} catch (Exception e) {
    logger.log(e.getMessage());
}
```

## 2. 先写 try-catch-finally（先写测试时）

- 编写可能抛异常的代码时，**先从 try 块写起**：它相当于一个事务范围——catch 部分必须保证程序回到一致状态。
- 先构造异常路径的测试（让依赖抛异常），再实现。这与 TDD 的红灯先行是一致的。

## 3. 使用非受检异常（多数场景）

受检异常（checked exception）把异常处理契约钉死在方法签名上：

- 底层修改签名会沿调用链一路向上传导，违反开放—闭合原则；
- 封装好的通用代码会因类型系统被迫关心并不关心的细节。

因此，除非有强制理由（如要求调用方必须处理的恢复协议），优先使用非受检异常。（语言差异：Java/TypeScript 区分检查机制；Go 等显式错误传递的语言按其惯用法来，但下述原则同样适用。）

## 4. 给出发生环境的信息

抛出的异常应回答：**什么操作失败了、为什么失败、当时的上下文是什么。**

```text
// 差
throw new Exception("error");

// 好
throw new IOException(
    "读取配置文件失败: " + configPath + " (文件不存在或无读取权限)");
```

对异常做无信息的记录（`log(e)` 不带消息、或干脆吞掉）都是"糊墙"行为。

## 5. 按调用方需要定义异常类

对异常分类的最重要依据是**调用方如何捕获它**：

- 调用方会以不同方式处理 → 分开定义异常类；
- 处理方式相同 → 合并到一个异常类，用消息区分细节。

包装第三方 API 时尤其如此：用一个自己的异常基类承接外部库的所有异常，同时保留 `cause` 链。

```text
class RepositoryError extends Error {
    constructor(message: string, public readonly cause?: unknown) {
        super(message);
    }
}
```

这样上层代码不会因为底层换了 HTTP 客户端而整片重写 catch 子句。

## 6. 定义常规流程：特例模式（Special Case Pattern）

很多时候调用方其实不想处理异常，而是想要一个"正常运转的默认值"。创建特例对象来消化边界情况：

```text
// 特例：空雇员对象，代替返回 null
NULL_EMPLOYEE = new Employee("员工不存在", ...);

getEmployee(id) {
    Employee e = database.find(id);
    return (e == null) ? NULL_EMPLOYEE : e;
}
```

调用方代码从此是无分支的快乐路径。

## 7. 别返回 null

返回 `null` 等于给每次调用都埋上一颗 NPE 地雷：

```text
// 只要有一处忘了判空就爆炸
List<Employee> employees = getEmployees();
if (employees != null) { ... }
```

改法二选一：

- **抛异常**（当 null 是真的异常情形）；
- **返回特例对象**（空集合 `[]` 是最常用特例——对集合而言，返回空集几乎总是对的）。

## 8. 别传递 null

除非调用的 API 明文允许 `null` 参数，否则禁止传 `null`。大部分语言无法在编译期保证这一点，只能靠约定与防御：参数校验、断言库、以及不为 null 提供官方入口。

## 自查清单

- [ ] 主流程读起来像主流程吗？还是被 try/catch 和判空淹没？
- [ ] 每个异常都有足够的上下文信息吗？（谁失败了、为什么）
- [ ] 有没有被吞掉的异常？（catch 后什么都不做的都是事故现场）
- [ ] 有没有函数返回 null？能不能换成空集合/特例/异常？
- [ ] catch 的粒度是否和调用方的处理能力对应？
