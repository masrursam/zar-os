const fs = require('fs');
const path = require('path');
const axios = require('axios');

const CONFIG_PATH = path.join(__dirname, 'config.json');

const loadConfig = () => {
  try {
    const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    console.error(`Error loading config file: ${error.message}`);
    process.exit(1);
  }
};

const CONFIG = {
  ...loadConfig(),
  logFile: path.join(__dirname, 'checkin-log.txt'),
  lastClaimFile: path.join(__dirname, 'last-claim.json'),
  countdownIntervalSeconds: 10, 
  checkServerIntervalMinutes: 60 
};

const log = (message) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  
  fs.appendFileSync(CONFIG.logFile, logMessage + '\n');
};

const createApiClient = (token) => {
  return axios.create({
    baseURL: CONFIG.baseUrl,
    headers: {
      'accept': 'application/json, text/plain, */*',
      'accept-encoding': 'gzip, deflate, br, zstd',
      'accept-language': 'en-US,en;q=0.6',
      'origin': 'https://testnet.app.zaros.fi',
      'referer': 'https://testnet.app.zaros.fi/',
      'sec-ch-ua': '"Not(A:Brand";v="99", "Brave";v="133", "Chromium";v="133"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site',
      'sec-gpc': '1',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
      'Authorization': `Bearer ${token}`
    }
  });
};

const checkAnalyticsAccess = async (apiClient) => {
  try {
    const response = await apiClient.get(`/analytics?type=access&wallet=${CONFIG.walletAddress}&accountId=${CONFIG.accountId}`);
    log('Analytics access checked successfully');
    return response.data;
  } catch (error) {
    log(`Error checking analytics access: ${error.message}`);
    return null;
  }
};

const getFestivalTicketsBig = async (apiClient) => {
  try {
    const response = await apiClient.get('/festival/tickets?big=true');
    log('Retrieved big festival tickets successfully');
    return response.data;
  } catch (error) {
    log(`Error getting big festival tickets: ${error.message}`);
    return null;
  }
};

const getFestivalTicketsSmall = async (apiClient) => {
  try {
    const response = await apiClient.get('/festival/tickets?big=false');
    log('Retrieved small festival tickets successfully');
    return response.data;
  } catch (error) {
    log(`Error getting small festival tickets: ${error.message}`);
    return null;
  }
};

const getDailyInfo = async (apiClient) => {
  try {
    const response = await apiClient.get(`/festival/daily?tradingAccountId=${CONFIG.accountId}`);
    log('Retrieved daily info successfully');
    return response.data;
  } catch (error) {
    log(`Error getting daily info: ${error.message}`);
    return null;
  }
};

const getUserCards = async (apiClient) => {
  try {
    const response = await apiClient.get(`/festival/cards?tradingAccountId=${CONFIG.accountId}`);
    log('Retrieved user cards successfully');
    return response.data;
  } catch (error) {
    log(`Error getting user cards: ${error.message}`);
    return null;
  }
};

const saveLastClaimTime = (date = new Date()) => {
  const claimData = {
    lastClaimTime: date.toISOString(),
    nextClaimTime: new Date(date.getTime() + 24 * 60 * 60 * 1000).toISOString()
  };
  
  try {
    fs.writeFileSync(CONFIG.lastClaimFile, JSON.stringify(claimData, null, 2));
    log(`Saved claim time data. Next claim available at: ${claimData.nextClaimTime}`);
  } catch (error) {
    log(`Error saving claim time data: ${error.message}`);
  }
};

const getTimeUntilNextClaim = () => {
  try {
    if (fs.existsSync(CONFIG.lastClaimFile)) {
      const claimData = JSON.parse(fs.readFileSync(CONFIG.lastClaimFile, 'utf8'));
      const nextClaimTime = new Date(claimData.nextClaimTime);
      const now = new Date();
      
      const timeLeft = Math.max(0, nextClaimTime - now);
      const hours = Math.floor(timeLeft / (1000 * 60 * 60));
      const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
      
      const formattedTimeLeft = `${hours}h ${minutes}m ${seconds}s`;
      
      return { 
        canClaim: timeLeft <= 0, 
        timeLeft: formattedTimeLeft,
        nextClaimTime: nextClaimTime.toLocaleString(),
        millisRemaining: timeLeft
      };
    }
    
    return { 
      canClaim: true, 
      timeLeft: "0h 0m 0s", 
      nextClaimTime: "Now",
      millisRemaining: 0
    };
  } catch (error) {
    log(`Error checking next claim time: ${error.message}`);
    return { 
      canClaim: true, 
      timeLeft: "0h 0m 0s", 
      nextClaimTime: "Now",
      millisRemaining: 0
    };
  }
};

const displayCountdown = (claimInfo) => {
  console.clear();
  
  const separator = "=".repeat(50);
  
  console.log(separator);
  console.log(`ZAROS DAILY CHECK-IN STATUS (${new Date().toLocaleString()})`);
  console.log(separator);
  
  if (claimInfo.canClaim) {
    console.log(`✅ YOU CAN CLAIM NOW!`);
    console.log(`🔄 Attempting to claim...`);
  } else {
    console.log(`⏳ NEXT CLAIM AVAILABLE IN: ${claimInfo.timeLeft}`);
    console.log(`📆 NEXT CLAIM DATE: ${claimInfo.nextClaimTime}`);
  }
  
  console.log(separator);
  console.log(`Account ID: ${CONFIG.accountId}`);
  console.log(`Wallet: ${CONFIG.walletAddress.substring(0, 6)}...${CONFIG.walletAddress.substring(CONFIG.walletAddress.length - 4)}`);
  console.log(separator);
  console.log(`Press Ctrl+C to stop the script`);
};

const checkClaimStatus = async (apiClient) => {
  try {
    await apiClient.post(`/festival/daily/claim?tradingAccountId=${CONFIG.accountId}`);
    
    log('Daily reward claimed successfully!');
    saveLastClaimTime();
    return { 
      success: true, 
      message: 'Reward claimed successfully' 
    };
  } catch (error) {
    if (error.response && error.response.status === 400) {
      const errorMessage = error.response.data;
      log(`Server returned an error: ${JSON.stringify(errorMessage)}`);
      
      if (typeof errorMessage === 'string' && 
          errorMessage.includes("You can only claim the next reward after 1 day has passed")) {
        
        log('Server indicates we need to wait 24 hours for the next claim');
        
        saveLastClaimTime();
        
        return { 
          success: false, 
          message: 'Need to wait 24 hours',
          needsCountdown: true
        };
      } else {
        return { 
          success: false, 
          message: 'Daily reward already claimed or other error',
          needsCountdown: false
        };
      }
    }
    
    log(`Error checking claim status: ${error.message}`);
    return { 
      success: false, 
      message: `Error: ${error.message}`,
      needsCountdown: false
    };
  }
};

const attemptClaim = async () => {
  if (!CONFIG.sessionToken) {
    log('No session token found in config.json');
    return false;
  }
  
  const apiClient = createApiClient(CONFIG.sessionToken);
  
  try {
    await checkAnalyticsAccess(apiClient);
    
    const dailyInfo = await getDailyInfo(apiClient);
    
    if (dailyInfo) {
      log(`Daily info from server - Claimed status: ${dailyInfo.claimed}`);
      
      if (!dailyInfo.claimed) {
        const claimStatus = await checkClaimStatus(apiClient);
        
        if (claimStatus.success) {
          log('Successfully claimed daily reward!');
          
          const userCards = await getUserCards(apiClient);
          
          if (userCards) {
            log(`Total cards count: ${userCards.length}`);
            
            if (userCards.length > 0) {
              const latestCard = userCards[userCards.length - 1];
              log(`Latest card claimed: ${latestCard.name || 'Unknown'} (Card ID: ${latestCard.id || 'Unknown'})`);
            }
          }
          
          return true; 
        } else {
          log(`Claim attempt result: ${claimStatus.message}`);
          
          if (claimStatus.needsCountdown) {
            return false; 
          }
        }
      } else {
        log('Server indicates daily reward already claimed today');
        saveLastClaimTime();
      }
    }
    
    await getFestivalTicketsBig(apiClient);
    await getFestivalTicketsSmall(apiClient);
    
    return false; 
  } catch (error) {
    log(`Error during check-in process: ${error.message}`);
    return false;
  }
};

const startContinuousProcess = () => {
  let countdownInterval;
  let serverCheckInterval;
  let isClaimInProgress = false;
  
  log('Starting Zaros continuous check-in process...');
  log('Press Ctrl+C to stop the script');
  
  if (!fs.existsSync(CONFIG.lastClaimFile)) {
    saveLastClaimTime(new Date(Date.now() - (24 * 60 * 60 * 1000))); 
  }
  
  const updateCountdown = () => {
    const claimInfo = getTimeUntilNextClaim();
    displayCountdown(claimInfo);
    
    if (claimInfo.canClaim && !isClaimInProgress) {
      isClaimInProgress = true;
      
      attemptClaim().then(success => {
        isClaimInProgress = false;
        
        if (success) {
          log('Claim successful, countdown reset');
        } else {
          log('No claim performed or claim failed');
        }
      }).catch(error => {
        isClaimInProgress = false;
        log(`Error during claim attempt: ${error.message}`);
      });
    }
  };
  
  const checkServer = async () => {
    if (!isClaimInProgress) {
      log('Performing periodic server check...');
      const apiClient = createApiClient(CONFIG.sessionToken);
      
      try {
        const dailyInfo = await getDailyInfo(apiClient);
        
        if (dailyInfo) {
          log(`Server check - Claimed status: ${dailyInfo.claimed}`);
          
          const claimInfo = getTimeUntilNextClaim();
          if (dailyInfo.claimed && claimInfo.canClaim) {
            log('Syncing countdown with server state...');
            saveLastClaimTime();
          }
        }
      } catch (error) {
        log(`Error during server check: ${error.message}`);
      }
    }
  };
  
  countdownInterval = setInterval(updateCountdown, CONFIG.countdownIntervalSeconds * 1000);
  
  serverCheckInterval = setInterval(checkServer, CONFIG.checkServerIntervalMinutes * 60 * 1000);
  
  updateCountdown();
  checkServer();
  
  process.on('SIGINT', () => {
    log('Script terminated by user');
    clearInterval(countdownInterval);
    clearInterval(serverCheckInterval);
    process.exit(0);
  });
};

startContinuousProcess();