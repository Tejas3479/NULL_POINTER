## 📝 Pull Request Overview

**Description**:
Include a summary of the change, related issue numbers, and context.

**Type of Change**:
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Code quality / refactoring / formatting
- [ ] DevOps / CI/CD / containerization
- [ ] Documentation update

---

## 🧪 Verification & Testing Details

**Self-Checks**:
- [ ] My code compiles cleanly without TypeScript warnings/errors (`npx tsc --noEmit`).
- [ ] My code passes all pytest unit tests (`pytest backend/tests/`).
- [ ] I have verified formatting matches code conventions.
- [ ] My changes build successfully locally under Docker (`docker compose build`).

**Verification Steps**:
Detail replication steps and environment setups used for manual tests.
1. Run `docker compose up --build`
2. Access `http://localhost:3000`
3. Verify that ...
