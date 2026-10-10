"""Functional browser checks. Start the app first, then run python3 tests/smoke.py.
Uses a disposable browser context; no real client records are touched.
"""
import base64
import json
import os
from playwright.sync_api import sync_playwright, expect

BASE_URL = os.environ.get('STC_TEST_URL', 'http://127.0.0.1:8000')

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        context = browser.new_context(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(BASE_URL, wait_until='networkidle')
        expect(page.locator('h1')).to_have_text('Morning, Dean.')
        assert page.locator('.stat').count() == 4
        assert page.evaluate('document.fonts.check("500 16px Outfit")')
        assert page.locator('.brand img').evaluate('(img) => img.complete && img.naturalWidth > 0')
        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
        print('PASS: dashboard, local fonts, logo, desktop layout')

        def nav(route):
            page.locator('.nav-link[data-nav="'+route+'"]').click()
        def action(name):
            return page.locator('[data-action="'+name+'"]')
        def dialog():
            return page.get_by_role('dialog')
        def close():
            page.keyboard.press('Escape')
        def saved():
            return page.evaluate('JSON.parse(localStorage.getItem("stc-coach-v1"))')

        nav('clients')
        action('add-client').click()
        dialog().locator('[name=name]').fill('Jamie Test')
        dialog().locator('[name=email]').fill('jamie.test@example.com')
        dialog().get_by_role('button', name='Add client', exact=True).click()
        expect(page.locator('#clients-table')).to_contain_text('Jamie Test')
        page.reload(wait_until='networkidle')
        expect(page.locator('#clients-table')).to_contain_text('Jamie Test')
        page.locator('#view-search').fill('Jamie Test')
        assert page.locator('#clients-table tbody tr').count() == 1
        page.locator('.client-name').click()
        dialog().locator('[name=note]').fill('Keep tempo controlled. <script>window.bad=true</script>')
        dialog().get_by_role('button', name='Save note').click()
        expect(dialog().locator('.client-note')).to_contain_text('<script>window.bad=true</script>')
        assert not page.evaluate('Boolean(window.bad)')
        close()
        print('PASS: add client, persistence, filter, private notes, safe text rendering')

        nav('programmes')
        action('create-programme').click()
        dialog().locator('[name=name]').fill('Steady progress test')
        dialog().locator('[name=description]').fill('A focused session for building confidence.')
        dialog().locator('[name=client]').select_option(label='Jamie Test')
        dialog().locator('[name=exercises]').nth(0).check()
        dialog().locator('[name=exercises]').nth(1).check()
        dialog().get_by_role('button', name='Create programme', exact=True).click()
        expect(page.locator('#programme-cards')).to_contain_text('Steady progress test')
        test_card = page.locator('.programme-card').filter(has_text='Steady progress test')
        test_card.get_by_role('button',name='View programme').click()
        expect(dialog()).to_contain_text('Jamie Test')
        dialog().get_by_role('button',name='Log session').click()
        for checkbox in dialog().locator('[name=complete]').all():
            checkbox.check()
        dialog().get_by_role('button',name='Complete session',exact=True).click()
        d=saved()
        jamie=next(c for c in d['clients'] if c['name']=='Jamie Test')
        assert len([l for l in d['logs'] if l['client']==jamie['id']]) == 1
        assert jamie['programme']==next(pr for pr in d['programmes'] if pr['name']=='Steady progress test')['id']
        print('PASS: programme creation, assignment, workout completion, attendance points')

        nav('nutrition')
        page.locator('#client-select').select_option(label='Jamie Test')
        page.locator('#targets-form [name=calories]').fill('2400')
        page.locator('#targets-form').get_by_role('button',name='Save targets').click()
        action('log-food').click()
        for field,value in {'name':'Oats and yoghurt','calories':'450','protein':'30','carbs':'60','fat':'10'}.items():
            dialog().locator('[name='+field+']').fill(value)
        dialog().get_by_role('button',name='Log food',exact=True).click()
        expect(page.locator('.meal-row')).to_contain_text('Oats and yoghurt')
        assert page.locator('.macro-ring strong').first.inner_text()=='450'
        action('water').click()
        assert '0.25 L logged' in page.locator('main').inner_text()
        page.reload(wait_until='networkidle')
        page.locator('#client-select').select_option(label='Jamie Test')
        expect(page.locator('#targets-form [name=calories]')).to_have_value('2400')
        expect(page.locator('main')).to_contain_text('Oats and yoghurt')
        print('PASS: client nutrition targets, meal macros, water, reload persistence')

        nav('progress')
        page.locator('#client-select').select_option(label='Jamie Test')
        action('log-result').click()
        dialog().locator('[name=kind]').select_option('Deadlift')
        dialog().locator('[name=value]').fill('180')
        dialog().get_by_role('button',name='Save result').click()
        expect(page.locator('.metric').first).to_contain_text('180')
        nav('leaderboard')
        page.locator('[data-action=board][data-value=Deadlift]').click()
        expect(page.locator('.leader-table tbody tr').first).to_contain_text('Jamie Test')
        expect(page.locator('.leader-table tbody tr').first).to_contain_text('180 kg')
        print('PASS: benchmark logging, personal chart, sorted club leaderboard')

        nav('schedule')
        action('create-session').click()
        dialog().locator('[name=name]').fill('Jamie coaching session')
        dialog().locator('[name=type]').select_option('1-to-1')
        dialog().locator('[name=clients][value="'+jamie['id']+'"]').check()
        dialog().get_by_role('button',name='Add session',exact=True).click()
        row=page.locator('.session-row').filter(has_text='Jamie coaching session')
        row.get_by_role('button',name='View Jamie coaching session at 09:00').click()
        dialog().get_by_role('button',name='Complete session').click()
        expect(dialog()).to_contain_text('Attendance has been saved')
        close()
        assert len([l for l in saved()['logs'] if l['client']==jamie['id']])==2
        row=page.locator('.session-row').filter(has_text='Jamie coaching session')
        row.get_by_role('button',name='View Jamie coaching session at 09:00').click()
        assert dialog().get_by_role('button',name='Complete session').count()==0
        close()
        action('week-next').click()
        action('today').click()
        expect(page.locator('.schedule-list')).to_contain_text('Jamie coaching session')
        print('PASS: schedule creation, attendance, duplicate-completion prevention, week navigation')

        nav('overview')
        action('checkins').click()
        before=dialog().locator('.checkin-item').count()
        dialog().locator('[data-action=review-checkin]').first.click()
        assert dialog().locator('.checkin-item').count()==before-1
        close()
        page.keyboard.press('Control+k')
        page.locator('#global-search').fill('Jamie Test')
        page.locator('.search-result').click()
        expect(dialog()).to_contain_text('Jamie Test')
        close()
        print('PASS: check-in review and keyboard workspace search')

        nav('library')
        action('add-exercise').click()
        for field,value in {'name':'Test shoulder press','equipment':'Dumbbell','prescription':'3 × 10','cues':'Set a comfortable stance.\nPress with control.'}.items():
            dialog().locator('[name='+field+']').fill(value)
        dialog().get_by_role('button',name='Add exercise',exact=True).click()
        expect(dialog()).to_contain_text('Test shoulder press')
        video_b64=page.evaluate('''async () => {
            const canvas=document.createElement('canvas');canvas.width=160;canvas.height=90;
            const ctx=canvas.getContext('2d');ctx.fillStyle='#002c8c';ctx.fillRect(0,0,160,90);
            const stream=canvas.captureStream(10),chunks=[];
            const recorder=new MediaRecorder(stream,{mimeType:'video/webm'});
            const done=new Promise(resolve=>recorder.onstop=resolve);
            recorder.ondataavailable=e=>chunks.push(e.data);recorder.start();
            await new Promise(resolve=>setTimeout(resolve,350));ctx.fillStyle='white';ctx.fillRect(50,30,30,30);
            await new Promise(resolve=>setTimeout(resolve,350));recorder.stop();await done;
            stream.getTracks().forEach(t=>t.stop());
            const bytes=new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer());
            return btoa(Array.from(bytes,b=>String.fromCharCode(b)).join(''));
        }''')
        page.locator('#video-upload').set_input_files({'name':'test-demo.webm','mimeType':'video/webm','buffer':base64.b64decode(video_b64)})
        expect(dialog().locator('video')).to_be_visible()
        page.wait_for_function('document.querySelector("video")?.readyState >= 2')
        close()
        page.reload(wait_until='networkidle')
        page.locator('#view-search').fill('Test shoulder press')
        page.locator('[data-action=exercise]').first.click()
        expect(dialog().locator('video')).to_be_visible()
        page.wait_for_function('document.querySelector("video")?.readyState >= 2')
        close()
        print('PASS: exercise creation, real video upload/playback, IndexedDB persistence')

        nav('settings')
        page.locator('[name=coach]').fill('Dean Test')
        page.locator('[name=club]').fill('The Test Club')
        page.locator('[name=checkinAlerts]').uncheck()
        page.get_by_role('button',name='Save changes').click()
        page.reload(wait_until='networkidle')
        expect(page.locator('[name=club]')).to_have_value('The Test Club')
        expect(page.locator('[name=checkinAlerts]')).not_to_be_checked()
        with page.expect_download() as download_info:
            action('export').click()
        download=download_info.value
        with open(download.path()) as f:
            exported=json.load(f)
        assert exported['settings']['club']=='The Test Club'
        assert next(c for c in exported['clients'] if c['id']==jamie['id'])['name']=='Jamie Test'
        print('PASS: settings persistence and downloadable workspace backup')

        page.set_viewport_size({'width':390,'height':844})
        page.wait_for_timeout(300)
        for route in ['overview','clients','programmes','nutrition','library','progress','schedule','leaderboard','settings']:
            page.locator('[data-action=menu]').click()
            page.locator('.nav-link[data-nav="'+route+'"]').click()
            assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'),route
            expect(page.locator('h1')).to_be_visible()
        page.locator('[data-action=menu]').click()
        page.keyboard.press('Escape')
        assert 'open' not in page.locator('.sidebar').get_attribute('class')
        assert not errors,errors
        print('PASS: 9 mobile routes, mobile navigation, no horizontal overflow, no JavaScript errors')
        context.close()
        browser.close()

if __name__=='__main__':
    run()
