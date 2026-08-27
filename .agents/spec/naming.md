# 命名

> 名字在程序中无处不在：变量、函数、类、参数、包、文件、目录。我们命名、再命名、反复命名。好的命名是最低成本、最高回报的可读性投资。

**何时阅读：** 引入、修改或评审任何标识符（变量、函数、类型、文件、目录、包）之前。加载协议见仓库根目录 [AGENTS.md](../../AGENTS.md)。

## 1. 名副其实

如果名字需要注释来补充，那么这个名字就不算名副其实。

```text
// 差：d 说明不了任何东西
int d;

// 好：看到名字就知道含义与单位
int elapsedTimeInDays;
```

反例：

```text
// 这个函数做了什么？
List<int[]> getThem();
```

改造后：

```text
List<Cell> getFlaggedCells();
```

**要点：**

- 选择体现本意的名字，让人更容易理解和修改代码。
- 单字母名（除循环计数器 `i/j/k`、异常 `e` 等广泛约定外）与"占位注释"是同一类问题。
- 带单位的量，把单位写进名字：`timeoutMs`、`fileSizeBytes`。

## 2. 避免误导

- 不要使用与本意相悖的词。`accountList` 只在它真是 `List` 类型时可用；否则用 `accounts` / `accountGroup` 更安全。
- 避免外形相似导致误读的名字：`XYZControllerForEfficientHandlingOfStrings` 与 `XYZControllerForEfficientStorageOfStrings` 几乎不可区分。
- 小写字母 `l` 与数字 `1`、大写 `O` 与 `0` 是可读性陷阱。

## 3. 做有意义的区分

仅仅为了编译器满意而添加的数字后缀和噪音词都应避免：

| 问题模式 | 反例 | 改法 |
| --- | --- | --- |
| 数字系列 | `a1, a2, a3` | 用真实区别命名 |
| 废话词 | `ProductInfo` / `ProductData` / `ProductObject` | 区分不出含义就叫同一个名字，或用真实差异 |
| 模糊动词 | `processData`, `doWork`, `handleIt` | 写清楚做什么 |

`Name`、`Info`、`Data`、`Manager`、`Processor`、`Handler` 这类词单独出现时几乎不携带信息，警惕它们出现在候选名单里互相竞争。

## 4. 使用可以读出来的名字

名字应当能读出来并方便讨论："genymdhms" 没法和同事口头交流，"generationTimestamp" 可以。

## 5. 使用可搜索的名字

- 单字母和常量数字难以全文搜索。使用频率越高、作用域越大的实体，越需要长而准确的名字。
- 魔法数字抽成具名常量：

```text
// 差
for (int j = 0; j < 34; j++) { s += (t[j] * 4) / 5; }

// 好
const int WORK_DAYS_PER_WEEK = 5;
for (int j = 0; j < NUMBER_OF_TASKS; j++) {
    realTaskDays += taskEstimate[j] * WORK_DAYS_PER_WEEK;
}
```

## 6. 避免无意义的编码

- 不用类型前缀（匈牙利命名法）：现代 IDE 让它成了噪音。
- 不用成员前缀（`m_`）：类和函数应当小到无需前缀也能一眼看清。
- 接口不加装饰前缀（如 `IShapeFactory`），实现如有冲突再考虑加后缀（如 `ShapeFactoryImpl`）。

## 7. 类名与方法名的词性

- **类/类型/模块**用名词或名词短语：`Customer`, `WikiPage`, `AccountRepository`。避免 `Manager`, `Processor`, `Data`, `Info`。
- **方法**用动词或动宾短语：`postPayment`, `deletePage`, `save`。
- 属性访问器按语言惯例使用 `get/set/is` 前缀；构造器的重载变体可用静态工厂方法名描述参数含义。
- 避免混淆的模糊词：能说清就不说 `get`——`fetchPage()` 与 `getPage()` 若语义不同（缓存 vs 计算），名字必须体现差异。

## 8. 一个概念一个词，一个词一个概念

- 给同一个抽象选一个动词并且一以贯之：`fetch` / `retrieve` / `get` 三选一，全项目统一。
- 同样的目的不要发明两套词汇（controller / manager / driver 轮流用）。
- 反向也成立：不同用途不要复用同一个词。`add` 用于"把元素并入集合"，那么"数值相加""组合两个对象"就用别的词（`plus`、`concat`……），否则读者会做错误联想。

## 9. 使用解决方案领域与问题领域的名称

- 只有程序员会看的代码，放心用计算机科学术语、算法名、设计模式名：`JobQueue`, `AccountVisitor`。
- 描述需求的问题领域术语优先于随手编的名字；资深的合作者可能会向你求证这些术语的含义。
- 两者都不适用时才自造词，且在新造前先认真找一遍标准说法。

## 10. 添加有意义的语境，不添加无用语境

- 缺乏语境时补齐语境：`addrFirstName`、`addrState` 优于孤立的 `firstName`。
- 更好的做法是用类 encapsulate 语境，让变量从属于有意义的结构（`Address` 类的 `firstName` 字段）。
- 但不要为了"统一"添加无用前缀：给所有东西挂上项目缩写 `GSDAccountAddress` 只会让搜索和阅读变糟。

## 自查清单

- [ ] 删掉名字后我还需要读上下文才能理解这个实体吗？（需要 → 改名）
- [ ] 有没有两个只差一个词缀的名字可以被搜错、读错？
- [ ] 同一概念在项目中是否只有一个动词？同一动词是否只指一件事？
- [ ] 所有魔法数字是否已用具名常量替代？
- [ ] 名字里的单位（ms/bytes/count）齐全吗？
