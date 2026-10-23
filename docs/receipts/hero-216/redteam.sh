cd "$(git rev-parse --show-toplevel)/dist/public"
echo "== RED-TEAM bundle grep: dist/public (final build), $(find . -name '*.js' | wc -l) js files =="
for p in 'functionName:"mint"' 'functionName:"whitelistMint"' '0xeb2C36' '0xeb2c36' '735 DAI' 'fund the contract owner' 'Pending Funding' '0x5F1D1af1' '0x5f1d1af1' '0xdf02e0aa' '0x2dCDEA8a' '0x2dcdea8a' '0x0AFADaF9' '0x0afadaf9' '0x43f319' '0xCFa2b3' '0xcfa2b3'; do
  echo "[$p] files=$(grep -rlF -- "$p" . | wc -l)"; done
echo "[regex ~735|735 DAI] files=$(grep -rlE '~735|735[[:space:]]*(DAI|dai)' . | wc -l)"
echo "[any functionName *mint*] $(grep -rohE 'functionName:"[A-Za-z]*[Mm]int[A-Za-z]*"' . | sort | uniq -c | tr '\n' ' ')"
f=$(ls assets/NFTMint-*.js); echo "[$f writeContract( calls] $(grep -o 'writeContract(' $f | wc -l)"
echo "== MUST be present =="
for p in 'Minting paused for security' 'Do not send funds, tokens or NFTs to these addresses' 'New stakes paused for security' '0x5F1D…[COMPROMISED]…7Dba' '0xdf02…[MALICIOUS]…8792' '0x2dCD…[ATTACKER]…dEC8' '0x5Fad…[COMPROMISED]…97bE' '0xCe60…[COMPROMISED]…7B36' '0xeb2C…[UNVERIFIED]…24e6' 'security-notice' 'Aviso de seguridad'; do
  echo "[$p] files=$(grep -rlF -- "$p" . | tr '\n' ' ')"; done
echo "== known remaining full addresses (read-only use, not in notice) =="
echo "[HeroCards Base 0x5Fad096a…] $(grep -rlF 0x5Fad096af059 . | tr '\n' ' ') (heroCards-config reads; writes removed + blocked)"
echo "[HeroCards PLS 0xCe609B3A…] $(grep -rlF 0xCe609B3A82E8 . | tr '\n' ' ')"
echo "[donation receiver 0x94e529…] $(grep -rliF 0x94e52915 . | tr '\n' ' ') (TreasuryDisplay balance reads; UI defanged + warning)"
echo "[ABI entries mint/whitelistMint (ABI JSON only)] $(grep -roh 'name:"whitelistMint"\|name:"mint"' . | sort | uniq -c | tr '\n' ' ')"
