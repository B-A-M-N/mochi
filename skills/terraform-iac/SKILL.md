---
name: terraform-iac
description: Terraform/OpenTofu infrastructure as code: module layout, state safety, plan review, drift. Use when asked for terraform, IaC, or infrastructure provisioning.
---

# Terraform Procedure

## 1. Layout: environments thin, modules shared
- `modules/<thing>/` holds reusable units (VPC, cluster, database); `envs/<prod|staging>/` holds only variable files + backend config. Copy-pasted environments drift within a month.
- One state file per environment per blast-radius unit — a single global state means every plan touches everything.

## 2. State is sacred
- Remote backend (S3 + DynamoDB lock / Terraform Cloud / GCS) from day one. Local `terraform.tfstate` on a laptop is how two engineers corrupt each other.
- Never hand-edit state; `terraform state mv/rm/import` for refactors, with the plan re-run after to prove no diff.

## 3. Plan is the code review
- Every change ships as `terraform plan` output in the PR — reviewers read the +/-/~ lines, not the HCL. `plan -detailed-exitcode` in CI fails the build on unexpected changes.
- `-target` is for emergencies only; a targeted apply that skips dependencies is how half-applied states happen.

## 4. Drift and secrets
- Run scheduled `plan` (no apply) to catch click-ops drift; reconcile in code, not in the console.
- Secrets never in `.tfvars` committed files — vault provider, SSM/Secrets Manager data sources, or encrypted `sops` files. `terraform output` must never print a secret (mark `sensitive = true`).

## Pitfalls
- `count` vs `for_each`: use `for_each` with stable keys — removing item 0 from a `count` list destroys everything after it.
- Provider version upgrades change plan output: pin providers (`required_providers` + lock file), upgrade deliberately.
