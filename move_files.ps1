# Move files to appropriate folders

# Strategic Planning files
Move-Item -Path "docs\STRATEGIC_PLAN_OVERVIEW.md" -Destination "docs\strategic-planning\" -Force
Move-Item -Path "docs\STRATEGIC_PLAN_TECHNICAL.md" -Destination "docs\strategic-planning\" -Force
Move-Item -Path "docs\STRATEGIC_PLAN_INVESTOR_PREP.md" -Destination "docs\strategic-planning\" -Force

# Linear Setup files
Move-Item -Path "docs\LINEAR_SETUP_GUIDE.md" -Destination "docs\linear-setup\" -Force
Move-Item -Path "docs\LINEAR_DEPENDENCY_MAP.md" -Destination "docs\linear-setup\" -Force
Move-Item -Path "docs\LINEAR_WORKSPACE_SUMMARY.md" -Destination "docs\linear-setup\" -Force
Move-Item -Path "docs\LINEAR_IMPORT_TASKS.csv" -Destination "docs\linear-setup\" -Force

# Audit and Fix files
Move-Item -Path "docs\DOCUMENTATION_AUDIT_REPORT.md" -Destination "docs\audits\" -Force
Move-Item -Path "docs\DOCUMENTATION_FIXES_REQUIRED.md" -Destination "docs\audits\" -Force
Move-Item -Path "docs\DOCUMENTATION_CONSISTENCY_FIXES.md" -Destination "docs\audits\" -Force
Move-Item -Path "docs\CONSISTENCY_VERIFICATION_REPORT.md" -Destination "docs\audits\" -Force
Move-Item -Path "docs\BEFORE_AFTER_COMPARISON.md" -Destination "docs\audits\" -Force
Move-Item -Path "docs\FIXES_SUMMARY.md" -Destination "docs\audits\" -Force
Move-Item -Path "docs\SCHEMA_REFERENCE_GUIDE.md" -Destination "docs\audits\" -Force
Move-Item -Path "docs\DEVELOPER_CHECKLIST.md" -Destination "docs\audits\" -Force
Move-Item -Path "docs\DOCUMENTATION_UPDATE_SUMMARY.md" -Destination "docs\audits\" -Force
Move-Item -Path "docs\IMPLEMENTATION_STATUS_UPDATE.md" -Destination "docs\audits\" -Force

# Architecture files
Move-Item -Path "docs\ARCHITECTURE.md" -Destination "docs\architecture\" -Force
Move-Item -Path "docs\architecture_react_expo.md" -Destination "docs\architecture\" -Force
Move-Item -Path "docs\DATABASE.md" -Destination "docs\architecture\" -Force
Move-Item -Path "docs\EDGE_FUNCTIONS.md" -Destination "docs\architecture\" -Force
Move-Item -Path "docs\EDGE_FUNCTIONS_IMPLEMENTATION_LIST.md" -Destination "docs\architecture\" -Force
Move-Item -Path "docs\THIRD_PARTY_INTEGRATIONS.md" -Destination "docs\architecture\" -Force
Move-Item -Path "docs\booktalks_mobile_spec.md" -Destination "docs\architecture\" -Force

# API Reference files
Move-Item -Path "docs\API_REFERENCE.md" -Destination "docs\api-reference\" -Force

# Deployment files
Move-Item -Path "docs\DEPLOYMENT.md" -Destination "docs\deployment\" -Force
Move-Item -Path "docs\MIGRATION_GUIDE.md" -Destination "docs\deployment\" -Force
Move-Item -Path "docs\MIGRATION_MAP.md" -Destination "docs\deployment\" -Force

Write-Host "All files moved successfully!"

