// Runs in background — handles storage sync and daily reset
const API_BASE_URL = 'http://localhost:3000'

// Initialize on startup
chrome.runtime.onInstalled.addListener(details => {
  try {
    if (details.reason === 'install') {
      chrome.tabs.create({ url: 'http://localhost:3000/login' })
    }
    syncAuthFromWebApp()
    
    // Setup alarms
    chrome.alarms.create('syncAuth', { periodInMinutes: 5 })
    chrome.alarms.create('dailyReset', {
      when: getNextMidnight(),
      periodInMinutes: 24 * 60
    })
  } catch (error) {
    console.error('Error in onInstalled:', error)
  }
})

chrome.alarms.onAlarm.addListener(alarm => {
  try {
    if (alarm.name === 'syncAuth') {
      syncAuthFromWebApp()
    }
    if (alarm.name === 'dailyReset') {
      chrome.storage.local.get('stats', data => {
        const stats = data.stats || {}
        stats.today = 0
        chrome.storage.local.set({ stats })
      })
    }
  } catch (error) {
    console.error('Error in alarm:', error)
  }
})

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  try {
    syncAuthFromWebApp()

    if (msg.type === 'APPLICATION_LOGGED') {
      chrome.storage.local.get('stats', data => {
        const stats = data.stats || { today: 0, total: 0, interviews: 0 }
        stats.today += 1
        stats.total += 1
        chrome.storage.local.set({ stats })
      })
      return false
    }

    if (msg.type === 'GET_PROFILE') {
      chrome.storage.local.get(['profile', 'user', 'blacklist'], data => {
        sendResponse(data)
      })
      return true
    }
  } catch (error) {
    console.error('Error in message listener:', error)
  }
})

function getNextMidnight() {
  try {
    const now = new Date()
    const midnight = new Date(now)
    midnight.setHours(24, 0, 0, 0)
    return midnight.getTime()
  } catch (error) {
    console.error('Error in getNextMidnight:', error)
    return Date.now() + (24 * 60 * 60 * 1000)
  }
}

async function syncAuthFromWebApp() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/profile`, {
      credentials: 'include',
    })

    if (!res.ok) {
      if (res.status === 401) {
        chrome.storage.local.remove(['user', 'profile'])
      }
      return
    }

    const payload = await res.json()
    const profile = payload.data

    if (!profile) return

    const user = {
      id: profile.user_id,
      email: profile.email || '',
      full_name: profile.full_name || '',
    }

    // Fetch token for extension API calls
    try {
      const tokenRes = await fetch(`${API_BASE_URL}/api/get-token`, {
        credentials: 'include',
      })
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json()
        const token = tokenData.token || ''
        chrome.storage.local.set({ user: { ...user, token }, profile, autoApply: true })
      } else {
        chrome.storage.local.set({ user, profile, autoApply: true })
      }
    } catch {
      chrome.storage.local.set({ user, profile, autoApply: true })
    }

  } catch {
    // Ignore transient network failures
  }
}