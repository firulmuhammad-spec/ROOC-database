# Security Specification - Ragnarok Origin Classic Community Database

This document outlines the security architecture, invariants, threat modeling, and test cases for the ROOC Community Database's Firestore backend.

## 1. Data Invariants
Since the application uses a client-side administrative state and runs in a sandbox, there is no real-time Firebase Authentication tied to individual users. Therefore, our security depends entirely on strict schema validation, type checking, size limitations, and path hardening.

*   **Public Access**: All collections (`skills`, `new_patches`, `maps`, `cards`, `mvps`) allow public read access for all users (`allow read: if true`).
*   **Write Integrity**: Writes (create, update, delete) are allowed by anyone but strictly guarded by value limits, type safety, enum verification, and field presence.
*   **No Shadow Fields**: Any document must strictly match the permitted fields. Extra/hidden fields will be rejected.
*   **Id Poisoning Protection**: All custom document IDs (if provided) must match alphanumeric formats and not exceed 128 characters.

---

## 2. The "Dirty Dozen" Payloads (Schema Violation Attacks)
These payloads simulate attacks designed to corrupt the database, inject massive payloads, bypass enum checks, or introduce shadow fields.

### Payload 1: Skill with Shadow Fields (Ghost Attribute Attack)
```json
{
  "name": "Bash",
  "type": "PDMG",
  "percentage": "250%",
  "cooldown": "0.5s",
  "castTime": "Instant",
  "spCost": "15 SP",
  "description": "Powerful strike",
  "isVerifiedAdmin": true
}
```
*Expected Result: PERMISSION_DENIED due to unapproved key `isVerifiedAdmin`.*

### Payload 2: Skill with Invalid Enum Type
```json
{
  "name": "Bash",
  "type": "ULTRA_DAMAGE",
  "percentage": "250%",
  "cooldown": "0.5s",
  "castTime": "Instant",
  "spCost": "15 SP",
  "description": "Powerful strike"
}
```
*Expected Result: PERMISSION_DENIED because `type` is not in ["PDMG", "MDMG", "Support", "Passive"].*

### Payload 3: Skill description exceeding length limits (Denial of Wallet Attack)
```json
{
  "name": "Bash",
  "type": "PDMG",
  "percentage": "250%",
  "cooldown": "0.5s",
  "castTime": "Instant",
  "spCost": "15 SP",
  "description": "...[A repeating string of 50,000 characters]..."
}
```
*Expected Result: PERMISSION_DENIED because `description` size is greater than 5000 characters.*

### Payload 4: Card item with non-string stats (Type Spoof Attack)
```json
{
  "name": "Poring Card",
  "slot": "Armor",
  "effect": "MaxHP +100",
  "stats": 12345,
  "sourceMonster": "Poring"
}
```
*Expected Result: PERMISSION_DENIED because `stats` must be a string.*

### Payload 5: Map with negative minLevel constraint
```json
{
  "name": "Prontera",
  "minLevel": -5,
  "monsterList": ["Poring"],
  "description": "Green fields"
}
```
*Expected Result: PERMISSION_DENIED because `minLevel` must be between 1 and 150.*

### Payload 6: Map with missing required fields (Incomplete Write)
```json
{
  "name": "Prontera"
}
```
*Expected Result: PERMISSION_DENIED because `minLevel`, `monsterList`, and `description` are required.*

### Payload 7: Boss MVP with invalid size enum
```json
{
  "name": "Baphomet",
  "type": "MVP",
  "level": 80,
  "element": "Shadow",
  "race": "Demon",
  "size": "GIGANTIC_COLOSSUS",
  "spawnTime": "120",
  "location": "Glast Heim",
  "drops": ["Baphomet Card"]
}
```
*Expected Result: PERMISSION_DENIED because `size` is not in ["Small", "Medium", "Large"].*

### Payload 8: Boss level exceeding the max game level of 150
```json
{
  "name": "Baphomet",
  "type": "MVP",
  "level": 9999,
  "element": "Shadow",
  "race": "Demon",
  "size": "Large",
  "spawnTime": "120",
  "location": "Glast Heim",
  "drops": ["Baphomet Card"]
}
```
*Expected Result: PERMISSION_DENIED because `level` must be <= 150.*

### Payload 9: Patch update with future publication year
```json
{
  "title": "Future Patch",
  "date": "2050-01-01",
  "content": "Future notes",
  "author": "Time Traveler"
}
```
*Expected Result: PERMISSION_DENIED because `date` size is capped and must look like an actual date format.*

### Payload 10: Map with non-list/non-array monsterList
```json
{
  "name": "Prontera South",
  "minLevel": 1,
  "monsterList": "Poring, Lunatic",
  "description": "Grasslands"
}
```
*Expected Result: PERMISSION_DENIED because `monsterList` must be a List/Array type.*

### Payload 11: Boss MVP with non-list/non-array drops
```json
{
  "name": "Golden Thief Bug",
  "type": "MVP",
  "level": 40,
  "element": "Fire",
  "race": "Insect",
  "size": "Large",
  "spawnTime": "60",
  "location": "Sewer",
  "drops": "Golden Thief Bug Card"
}
```
*Expected Result: PERMISSION_DENIED because `drops` must be a List/Array type.*

### Payload 12: Skill with injection attack in name
```json
{
  "name": "../../../../etc/passwd",
  "type": "PDMG",
  "percentage": "200%",
  "cooldown": "1s",
  "castTime": "Instant",
  "spCost": "10 SP",
  "description": "Injection test"
}
```
*Expected Result: PERMISSION_DENIED if the identifier or fields violate text/regex constraints.*

---

## 3. Test Cases (TDD Blueprint)

We will verify these rules using standard Firestore assertions in our security model below.
