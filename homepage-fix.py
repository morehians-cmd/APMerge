import io


def edit(path, old, new):
    text = io.open(path, encoding='utf-8', newline='').read()
    if text.count(old) != 1:
        raise SystemExit('anchor not found exactly once in %s (%d)' % (path, text.count(old)))
    io.open(path, 'w', encoding='utf-8', newline='').write(text.replace(old, new))


HERO_OLD = 'onclick="goHero(2)"></button></div></section>\n<section id="homepage-values"'
HERO_NEW = 'onclick="goHero(2)"></button></div></section>\n<section id="homepage-intro" hidden style="padding:26px 0;background:#fff"><div class="wrap" id="homepageIntro"></div></section>\n<section id="homepage-values"'
edit('PublicHome.html', HERO_OLD, HERO_NEW)

SWAP_OLD = "if(r&&r.success&&r.data&&r.data.html){var el=document.getElementById('homepageEditable');if(el)el.innerHTML=r.data.html;}"
SWAP_NEW = "if(r&&r.success&&r.data&&r.data.html){var el=document.getElementById('homepageIntro'),box=document.getElementById('homepage-intro');if(el){el.innerHTML=r.data.html;if(box)box.removeAttribute('hidden');}}"
edit('PublicHome.html', SWAP_OLD, SWAP_NEW)

GUARD_OLD = "const hasRealContent = /<(p|li|h[1-4]|details|summary|blockquote)\\b/i.test(html) &&\n      !/Content to be added by the Administrator/i.test(html);"
GUARD_NEW = "const visible = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\\s+/g, '').trim();\n    const hasRealContent = /<(p|li|h[1-4]|details|summary|blockquote)\\b/i.test(html) &&\n      !/Content to be added by the Administrator/i.test(html) && !!visible;"
edit('Public.gs', GUARD_OLD, GUARD_NEW)

print('homepage intro fix applied')
