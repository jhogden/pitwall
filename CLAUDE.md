# CLAUDE.md - Development Guidelines

This document outlines core development principles and practices for this project. Following these guidelines ensures maintainable, testable, and robust code.

## SOLID Principles

These five principles form the foundation of good object-oriented design:

### Single Responsibility Principle (SRP)
Each class or module should have one, and only one, reason to change.

**Why it matters:** Classes with multiple responsibilities become fragile and difficult to maintain. Changes to one responsibility can break another.

**In practice:**
- A `UserService` should handle user business logic, not email sending or database connections
- A `ReportGenerator` should generate reports, not format them for display or save them to disk
- Extract separate concerns into dedicated classes

**Red flags:**
- Class names with "And" or "Manager"
- Methods that do multiple unrelated things
- Long files (>500 lines) with many dependencies

### Open/Closed Principle (OCP)
Software entities should be open for extension but closed for modification.

**Why it matters:** You should be able to add new functionality without changing existing, tested code.

**In practice:**
- Use interfaces and abstract classes to define contracts
- Favor composition over inheritance
- Use dependency injection to make components swappable
- Strategy pattern for varying algorithms

**Example:**
```python
# Bad: Must modify to add payment methods
class PaymentProcessor:
    def process(self, payment_type):
        if payment_type == "credit":
            # credit card logic
        elif payment_type == "paypal":
            # PayPal logic

# Good: Extend without modification
class PaymentProcessor:
    def __init__(self, strategy: PaymentStrategy):
        self.strategy = strategy

    def process(self):
        return self.strategy.execute()
```

### Liskov Substitution Principle (LSP)
Objects of a superclass should be replaceable with objects of its subclasses without breaking the application.

**Why it matters:** Violations create subtle bugs and make code unpredictable.

**In practice:**
- Subclasses should strengthen, not weaken, preconditions
- Don't throw exceptions in overridden methods that the base doesn't throw
- Ensure subclasses can fulfill the contract of the base class

**Red flags:**
- Subclass throws `NotImplementedError` for base class methods
- Subclass requires type checking (`isinstance`) to use correctly
- Subclass has stricter requirements than base class

### Interface Segregation Principle (ISP)
Clients should not be forced to depend on interfaces they don't use.

**Why it matters:** Fat interfaces create unnecessary coupling and force clients to implement methods they don't need.

**In practice:**
- Create small, focused interfaces
- Split large interfaces into role-specific ones
- Compose multiple small interfaces rather than one large one

**Example:**
```typescript
// Bad: Forces all users to implement unused methods
interface Worker {
    work(): void;
    eat(): void;
    sleep(): void;
}

// Good: Separate concerns
interface Workable {
    work(): void;
}

interface Eatable {
    eat(): void;
}
```

### Dependency Inversion Principle (DIP)
High-level modules should not depend on low-level modules. Both should depend on abstractions.

**Why it matters:** Direct dependencies on concrete implementations create tight coupling and make testing difficult.

**In practice:**
- Depend on interfaces/abstractions, not concrete classes
- Use dependency injection
- Create seams for testing

**Example:**
```java
// Bad: Direct dependency on concrete class
class UserController {
    private MySQLDatabase db = new MySQLDatabase();
}

// Good: Depend on abstraction
class UserController {
    private Database db;

    public UserController(Database db) {
        this.db = db;
    }
}
```

## Test-Driven Development (TDD)

TDD is not optional—it's the primary way we write code in this project.

### The Red-Green-Refactor Cycle

1. **RED**: Write a failing test first
   - Write the smallest test that fails
   - Run it to confirm it fails for the right reason
   - Don't write production code yet

2. **GREEN**: Write the minimum code to pass
   - Focus on making the test pass, not on perfect code
   - Take shortcuts if needed (we'll refactor next)
   - Run the test to confirm it passes

3. **REFACTOR**: Improve the code
   - Clean up duplication
   - Apply SOLID principles
   - Improve names and structure
   - Run tests to ensure nothing broke

**Commit after each cycle** (see Commit Practices below).

### TDD Benefits

- **Better design**: Writing tests first forces you to think about interfaces and dependencies
- **Comprehensive coverage**: Every line of code exists because a test required it
- **Living documentation**: Tests show how code should be used
- **Fearless refactoring**: Comprehensive tests give confidence to make changes
- **Faster debugging**: Test failures pinpoint problems immediately

### TDD Rules

1. **Write no production code except to pass a failing test**
2. **Write only enough test to demonstrate a failure**
3. **Write only enough production code to pass the test**

### Test Quality Guidelines

**Good tests are:**
- **Fast**: Run in milliseconds
- **Independent**: Can run in any order
- **Repeatable**: Same result every time
- **Self-validating**: Pass or fail, no manual inspection
- **Timely**: Written just before the production code

**Test structure (AAA pattern):**
```python
def test_user_can_be_created_with_valid_email():
    # Arrange
    email = "user@example.com"

    # Act
    user = User.create(email)

    # Assert
    assert user.email == email
    assert user.is_valid()
```

**What to test:**
- Public interfaces and behavior, not implementation
- Edge cases and boundary conditions
- Error handling and validation
- Integration points between components

**What not to test:**
- Private methods (test through public interface)
- Third-party library code
- Trivial getters/setters (unless they have logic)

## Commit Practices

### Commit Early and Often

**Minimum commit frequency:**
- After every Red-Green-Refactor cycle
- Before and after refactoring
- When switching tasks or contexts
- At least every 30 minutes of active work

**Why commit frequently:**
- Smaller commits are easier to review
- Easier to identify which change introduced a bug
- Creates a detailed history of your thought process
- Enables easy rollback of specific changes
- Reduces risk of losing work

### Commit Message Format

```
<type>: <subject>

<body (optional)>

<footer (optional)>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `test`: Adding or modifying tests
- `docs`: Documentation changes
- `style`: Formatting, missing semicolons, etc.
- `chore`: Maintenance tasks

**Subject line:**
- Use imperative mood ("Add feature" not "Added feature")
- Start with capital letter
- No period at the end
- 50 characters or less

**Examples:**
```
test: Add test for user email validation

feat: Implement user email validation

refactor: Extract email validation to separate class
```

### The TDD Commit Pattern

A typical TDD workflow produces commits like this:

```
test: Add failing test for User.create with valid email
feat: Implement User.create to pass email test
refactor: Extract email validation to EmailValidator class
test: Add test for invalid email format
feat: Add email format validation
refactor: Simplify validation logic using regex
```

### Commit Hygiene

**Do:**
- Commit working code (tests should pass)
- Write clear, descriptive messages
- Commit logically related changes together
- Use branches for features

**Don't:**
- Commit commented-out code (delete it instead)
- Commit debugging statements or console.logs
- Mix multiple concerns in one commit
- Commit broken tests or code
- Use vague messages like "fix stuff" or "WIP"

### When Tests Fail

If you discover a failing test:
1. **Don't commit** until tests pass
2. Fix the test or the code
3. Run full test suite
4. Commit with message explaining what was fixed

## Daily Workflow

Here's what a typical development session looks like:

```
1. Pull latest changes
2. Run full test suite (should be green)
3. Write failing test for new feature
4. Commit: "test: Add failing test for [feature]"
5. Write minimum code to pass
6. Commit: "feat: Implement [feature]"
7. Refactor if needed
8. Commit: "refactor: [description]"
9. Repeat steps 3-8
10. Push commits when feature is complete
```

## Code Review Checklist

Before submitting code for review:

**SOLID:**
- [ ] Each class has a single responsibility
- [ ] Code is open for extension, closed for modification
- [ ] Subtypes are substitutable for base types
- [ ] Interfaces are focused and client-specific
- [ ] Dependencies point to abstractions

**Tests:**
- [ ] All tests pass
- [ ] New code has corresponding tests
- [ ] Tests follow AAA pattern
- [ ] Tests are independent and repeatable
- [ ] Edge cases are covered

**Commits:**
- [ ] Commits are small and focused
- [ ] Commit messages are clear and descriptive
- [ ] Each commit represents a working state
- [ ] No debugging code or commented code
- [ ] Commit history tells a story

## Resources

- **SOLID Principles**: "Clean Code" by Robert C. Martin
- **TDD**: "Test Driven Development: By Example" by Kent Beck
- **Refactoring**: "Refactoring" by Martin Fowler
- **Commit Messages**: [Conventional Commits](https://www.conventionalcommits.org/)

---

**Remember:** These aren't bureaucratic rules—they're tools that make development faster, safer, and more enjoyable. Quality is built in through discipline, not bolted on later.
