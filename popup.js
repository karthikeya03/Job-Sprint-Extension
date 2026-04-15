async function init() {
  const data = await getStorage(['user', 'profile', 'stats', 'autoApply', 'activityLog', 'selectedSites'])

  const user = data.user
  const stats = data.stats || { today: 0, total: 0, interviews: 0 }
  const autoApply = data.autoApply !== false
  const log = data.activityLog || []
  const profile = data.profile
  const selectedSites = data.selectedSites || ['naukri']

  if (!user) {
    document.getElementById('loginPrompt').style.display = 'block'
    document.getElementById('mainUI').style.display = 'none'
    setLive(false)
    return
  }

  document.getElementById('loginPrompt').style.display = 'none'
  document.getElementById('mainUI').style.display = 'flex'
  setLive(true)

  // Stats
  document.getElementById('todayCount').textContent = stats.today || 0
  document.getElementById('totalCount').textContent = stats.total || 0
  document.getElementById('interviewCount').textContent = stats.interviews || 0

  // Progress
  const max = profile?.max_apps_per_day || 50
  const today = stats.today || 0
  document.getElementById('progressText').textContent = `${today} / ${max}`
  document.getElementById('progressFill').style.width = `${Math.min(100, Math.round((today / max) * 100))}%`

  // Toggle
  const toggle = document.getElementById('autoApplyToggle')
  const card = document.getElementById('toggleCard')
  const sub = document.getElementById('toggleSub')
  applyToggle(autoApply, toggle, card, sub)

  toggle.addEventListener('click', async () => {
    const cur = await getStorage(['autoApply'])
    const next = !(cur.autoApply !== false)
    await setStorage({ autoApply: next })
    applyToggle(next, toggle, card, sub)
  })

  // Site selector - navigate to external job sites on click
  const siteItems = document.querySelectorAll('.site-item[data-url]')
  siteItems.forEach(item => {
    item.style.cursor = 'pointer'
    item.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const url = item.dataset.url
      if (url) {
        chrome.tabs.create({ url: url })
      }
    })
  })

  // Activity log
  const logEl = document.getElementById('activityLog')
  if (log.length > 0) {
    logEl.innerHTML = log.slice(-10).reverse().map(item => `
      <div class="act-item">
        <div class="act-dot"></div>
        <span class="act-time">${item.time || '--:--'}</span>
        <span class="act-text">${item.text || 'Applied to a job'}</span>
      </div>
    `).join('')
  }

  // Plan badge
  const planBadge = document.getElementById('planBadge')
  if (profile?.plan) {
    planBadge.textContent = profile.plan.toUpperCase()
  }

  // Nav cards
  document.getElementById('dashCard').addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:3000/dashboard' })
  })
  document.getElementById('profileCard').addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:3000/profile' })
  })
  document.getElementById('trackerCard').addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:3000/tracker' })
  })
}

function applyToggle(on, toggle, card, sub) {
  toggle.className = on ? 'sw on' : 'sw'
  card.className = on ? 'toggle-card on' : 'toggle-card'
  sub.textContent = on ? 'Actively applying to jobs' : 'Enable to start applying automatically'
}

function setLive(on) {
  const badge = document.getElementById('liveBadge')
  const text = document.getElementById('liveText')
  badge.className = on ? 'live-badge' : 'live-badge off'
  text.textContent = on ? 'Live' : 'Offline'
}

function getStorage(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve))
}

function setStorage(data) {
  return new Promise(resolve => chrome.storage.local.set(data, resolve))
}

init()