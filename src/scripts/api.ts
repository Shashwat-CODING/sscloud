import { audio, pipedInstances, invidiousInstances, thumbnailProxies } from "../lib/dom";
import player from "../lib/player";
import { getSaved, generateImageUrl, notify, removeSaved, save } from "../lib/utils";

interface ApiData {
  name: string;
  url: string;
  custom: boolean;
}

interface ApiList {
  piped: ApiData;
  invidious: ApiData;
  image: ApiData;
}

const defData: ApiList = {
  'piped': {
    name: 'kavin.rocks 🌐',
    url: 'https://pipedapi.kavin.rocks',
    custom: false
  },
  'invidious': {
    name: 'fdn.fr 🇫🇷',
    url: 'https://invidious.fdn.fr',
    custom: false
  },
  'image': {
    name: 'leptons.xyz 🇦🇹',
    url: 'https://pipedproxy.leptons.xyz',
    custom: false
  }
};

const invidiousInstancesList = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://invidious.jing.rocks',
  'https://invidious.privacyredirect.com'
];

const clone = JSON.stringify(defData);
const iMap: { [key: string]: HTMLSelectElement } = { 'piped': pipedInstances, 'invidious': invidiousInstances, 'image': thumbnailProxies };
const apiRefreshBtn = document.getElementById('apiRefreshBtn') as HTMLButtonElement;
const serialisedList = getSaved('apiList_2') || '{}';

if (serialisedList !== '{}') {
  const apiList = JSON.parse(serialisedList) as ApiList;

  Object.entries(iMap).forEach(([key, instance]) => {
    instance.lastChild?.remove();
    const data = apiList[key as keyof ApiList];
    const { name, url, custom } = data;
    if (key === 'piped' && name === 'kavin.rocks 🌐') return;
    if (key === 'image' && name === 'leptons.xyz 🇦🇹') return;
    if (key === 'invidious' && name === 'fdn.fr 🇫🇷') return;
    if (custom) {
      const dom = instance.options[0];
      dom.value = url;
      dom.textContent = 'Custom : ' + name;
      dom.selected = true;
    }
    else instance.add(new Option(name, url, undefined, true));
  });
}

const txtReplace = (init: string, now: string) => {
  if (apiRefreshBtn.textContent) {
    apiRefreshBtn.textContent = apiRefreshBtn.textContent.replace(init, now);
  }
};

async function fetchAPIdata() {
  if (apiRefreshBtn.textContent?.includes('Generating')) {
    apiRefreshBtn.textContent = 'Instances Generation Stopped';
    throw new Error('Generation was abruptly stopped');
  }
  else apiRefreshBtn.textContent = 'Regenerate Instances';

  txtReplace('Regenerate', ' 0% Generating');

  try {
    const pipData = await fetch('https://piped-instances.kavin.rocks').then(res => res.json());
    let dataUsage = (new Blob([JSON.stringify(pipData)])).size / 1024;

    const invData = await fetch('https://api.invidious.io/instances.json').then(res => res.json());
    dataUsage += (new Blob([JSON.stringify(invData)])).size / 1024;

    const rate = 100 / (pipData.length + invData.length);
    let num = 0;

    for (const instance of pipData) {
      const temp = num.toFixed();
      num += rate;
      txtReplace(temp, num.toFixed());

      const name = instance.name + ' ' + instance.locations;
      const url = instance.api_url;
      const imgPrxy = instance.image_proxy_url;

      if (![...pipedInstances.options].map(opt => opt.value).includes(url))
        pipedInstances.add(new Option(name, url));

      try {
        const testImg = new Image();
        await new Promise<void>((resolve, reject) => {
          testImg.onload = () => testImg.width === 120 ? resolve() : reject('load failure');
          testImg.onerror = () => reject('server failure');
          testImg.src = generateImageUrl('1SLr62VBBjw', 'default', imgPrxy);
        });
        dataUsage += 0.08;
        if (![...thumbnailProxies.options].map(opt => opt.value).includes(imgPrxy))
          thumbnailProxies.add(new Option(name, imgPrxy));
      } catch (error) {
        console.log(`Loading thumbnail via ${imgPrxy} failed`);
      }
    }

    for (const instance of invData) {
      const temp = num.toFixed();
      num += rate;
      txtReplace(temp, num.toFixed());

      if (!instance[1].cors || !instance[1].api || instance[1].type !== 'https') continue;

      const [, dom, ain] = instance[0].split('.');
      const instanceName = [dom, ain].join('.') + ' ' + instance[1].flag;
      const url = instance[1].uri;

      try {
        const audioData = await fetch(`${url}/api/v1/videos/NwmIu9iPkR0`).then(res => res.json());
        if (!audioData || !audioData.adaptiveFormats) continue;

        dataUsage += (new Blob([JSON.stringify(audioData)])).size / 1024;

        const audioURL = audioData.adaptiveFormats[0].url;

        await new Promise<void>((resolve, reject) => {
          const audioElement = new Audio();
          audioElement.onloadedmetadata = () => resolve();
          audioElement.onerror = () => reject('response failure');
          audioElement.src = audioURL.replace(new URL(audioURL).origin, url);
        });

        dataUsage += 3.53;

        if (![...invidiousInstances.options].map(opt => opt.value).includes(url))
          invidiousInstances.add(new Option(instanceName, url));
      } catch (error) {
        console.log(`Failed to fetch or play audio via ${url}`);
      }
    }

    txtReplace('100% Generating', 'Regenerate');
    notify(`Instances successfully added. ${Math.ceil(dataUsage)}KB data was used.`);
  } catch (error) {
    apiRefreshBtn.textContent = 'Regenerate Instances';
  }
}

const apiAutoFetchSwitch = document.getElementById('apiAutoFetchSwitch') as HTMLElement;
apiAutoFetchSwitch.addEventListener('click', () => {
  getSaved('apiAutoFetch') ?
    removeSaved('apiAutoFetch') :
    save('apiAutoFetch', 'false');
});

getSaved('apiAutoFetch') ?
  apiAutoFetchSwitch.toggleAttribute('checked') :
  addEventListener('DOMContentLoaded', fetchAPIdata);

apiRefreshBtn.addEventListener('click', fetchAPIdata);

async function fetchInvidiousPlaybackData(videoId: string): Promise<any> {
  for (const instanceUrl of invidiousInstancesList) {
    try {
      const response = await fetch(`${instanceUrl}/api/v1/videos/${videoId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data && data.adaptiveFormats) {
        return data;
      }
    } catch (error) {
      console.log(`Failed to fetch data from ${instanceUrl}: ${error}`);
    }
  }
  throw new Error("All Invidious instances are unavailable. Please try again later.");
}

Object.entries(iMap).forEach(([type, instance]) => {
  instance.addEventListener('change', async () => {
    const selectedOption = instance.options[instance.selectedIndex];
    let name = selectedOption.textContent || '';
    let url = selectedOption.value;
    const custom = name.startsWith('Custom');

    if (custom) {
      url = prompt('Enter the URL') || '';
      if (!url) return;
      selectedOption.value = url;
      const [, dom, ain] = new URL(url).hostname.split('.');
      name = [dom, ain].join('.');
      selectedOption.textContent = 'Custom : ' + name;
    }

    if (!name || !url) return;

    const savedData: ApiList = JSON.parse(getSaved('apiList_2') || JSON.stringify(defData));

    savedData[type as keyof ApiList] = { name, url, custom };

    let listIsSame = true;
    const parsedClone = JSON.parse(clone);
    for (const key in parsedClone) {
      if (savedData[key as keyof ApiList].url !== parsedClone[key as keyof ApiList].url) {
        listIsSame = false;
        break;
      }
    }

    listIsSame ?
      removeSaved('apiList_2') :
      save('apiList_2', JSON.stringify(savedData));

    if (type === 'invidious') {
      audio.pause();
      const timeOfSwitch = audio.currentTime;
      try {
        const playbackData = await fetchInvidiousPlaybackData(audio.dataset.id || '');
        await player(audio.dataset.id || '');
        audio.currentTime = timeOfSwitch;
      } catch (error) {
        notify((error as Error).message);
      }
    }
  });
});
