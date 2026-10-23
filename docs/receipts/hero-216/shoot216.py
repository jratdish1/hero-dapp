import asyncio, json
from playwright.async_api import async_playwright
B="http://127.0.0.1:4173"; O="/workspace/hero-216/shots"
res={}
JS="""()=>{const n=document.querySelector('[data-testid=security-notice]');const tx=document.body.innerText;
 const sw=[...document.querySelectorAll('button')].filter(b=>/Switch to (Base|PulseChain)/.test(b.title)||/^(\\S+\\s)?(Base|PulseChain|PLS|BASE)$/.test(b.innerText.trim())).map(b=>b.title||b.innerText.trim());
 return {notice: !!n, noticeVisible: n? n.getBoundingClientRect().height>0:false, items: n? n.querySelectorAll('li').length:0,
  mintPanel: !!document.querySelector('[data-testid=mint-paused-panel]'),
  mintBtnDisabled: (document.querySelector('[data-testid=mint-paused-button]')||{}).disabled ?? null,
  stakeBanner: !!document.querySelector('[data-testid=stake-paused-banner]'),
  has735DAI: /735\\s*DAI/i.test(tx), hasEb2c36: tx.toLowerCase().includes('0xeb2c36'),
  hasFullDeployer: tx.toLowerCase().includes('0x5f1d1af1eba9'),
  esTitle: /aviso de seguridad/i.test(tx), switchers: sw}}"""
async def shot(page,name):
    await page.screenshot(path=f"{O}/{name}.png"); res[name]=await page.evaluate(JS)
async def toggle(page,target):
    for sel in [f'button[title="Switch to {target}"]', f'button:has-text("{target}")']:
        loc=page.locator(sel)
        for i in range(await loc.count()):
            if await loc.nth(i).is_visible():
                await loc.nth(i).click(); await page.wait_for_timeout(2000); return sel
    return None
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path="/usr/bin/google-chrome", headless=True, args=["--no-sandbox"])
        # First visit (intro modal showing) — notice must sit above it
        c0=await b.new_context(viewport={"width":1366,"height":900}); pg=await c0.new_page()
        await pg.goto(B+"/nft-mint", wait_until="networkidle"); await pg.wait_for_timeout(3000); await shot(pg,"00-first-visit-notice-above-intro-modal")
        await c0.close()
        ctx=await b.new_context(viewport={"width":1366,"height":900})
        await ctx.add_init_script("localStorage.setItem('hero-dapp-intro-completed','true'); document.cookie='herobase_intro_seen=true;path=/'")
        page=await ctx.new_page()
        await page.goto(B+"/", wait_until="networkidle"); await page.wait_for_timeout(2500); await shot(page,"01-landing-notice")
        await page.goto(B+"/nft-mint", wait_until="networkidle"); await page.wait_for_timeout(3000); await shot(page,"02-nft-mint-pulsechain")
        await page.screenshot(path=f"{O}/02b-nft-mint-pulsechain-full.png", full_page=True)
        res["toggle_to_base"]=await toggle(page,"Base"); await shot(page,"03-nft-mint-base")
        await page.screenshot(path=f"{O}/03b-nft-mint-base-full.png", full_page=True)
        await page.goto(B+"/stake/dai", wait_until="networkidle"); await page.wait_for_timeout(3000); await shot(page,"04-stake-dai")
        await page.screenshot(path=f"{O}/04b-stake-dai-full.png", full_page=True)
        await page.goto(B+"/dashboard", wait_until="networkidle"); await page.wait_for_timeout(3000)
        res["toggle_dash_base"]=await toggle(page,"Base"); await shot(page,"05-dashboard-notice-base")
        res["toggle_dash_pls"]=await toggle(page,"PLS"); await shot(page,"06-dashboard-notice-pulsechain")
        await page.evaluate("localStorage.setItem('hero-lang','es')"); await page.goto(B+"/nft-mint", wait_until="networkidle"); await page.wait_for_timeout(3000); await shot(page,"07-nft-mint-es")
        await b.close()
    print(json.dumps(res,indent=1))
asyncio.run(main())
