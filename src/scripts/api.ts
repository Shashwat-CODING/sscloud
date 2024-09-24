import { audio, pipedInstances, invidiousInstances, thumbnailProxies } from "../lib/dom";
import originalPlayer from "../lib/player";
import { getSaved, notify, removeSaved, save } from "../lib/utils";

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

const clone = JSON.stringify(defData);
const iMap: { [key: string]: HTMLSelectElement } = { 'piped': pipedInstances, 'invidious': invidiousInstances, 'image': thumbnailProxies };
const apiRefreshBtn = document.getElementById('apiRefreshBtn') as HTMLButtonElement;
const serialisedList = getSaved('apiList_2') || '{}';

if (serialisedList !== '{}') {
  const apiList: ApiList = JSON.parse(serialisedList);

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

async function fetchAPIdata() {
  // ... (keep the existing fetchAPIdata function as is)
}

const apiAutoFetchSwitch = document.getElementById('apiAutoFetchSwitch') as HTMLElement;
apiAutoFetchSwitch.addEventListener('click', () => {
  getSaved('apiAutoFetch') ?
    removeSaved('apiAutoFetch') :
    save('apiAutoFetch', 'false');
})

getSaved('apiAutoFetch') ?
  apiAutoFetchSwitch.toggleAttribute('checked') :
  addEventListener('DOMContentLoaded', fetchAPIdata);

apiRefreshBtn.addEventListener('click', fetchAPIdata);

// New Invidious instances list
const invidiousInstancesList = [
  { name: 'inv.nadeko.net 🇨🇱', url: 'https://inv.nadeko.net' },
  { name: 'invidious.nerdvpn.de 🇺🇦', url: 'https://invidious.nerdvpn.de' },
  { name: 'invidious.jing.rocks 🇯🇵', url: 'https://invidious.jing.rocks' },
  { name: 'invidious.privacyredirect.com 🇫🇮', url: 'https://invidious.privacyredirect.com' }
];

// New function to fetch data from Invidious instances
async function fetchInvidiousData(videoId: string) {
  for (const instance of invidiousInstancesList) {
    try {
      const response = await fetch(`${instance.url}/api/v1/videos/${videoId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (!data || !data.adaptiveFormats) {
        throw new Error('Invalid data received from the instance');
      }
      return { data, instance };
    } catch (error) {
      console.log(`Failed to fetch data from ${instance.name}: ${error}`);
    }
  }
  throw new Error('All Invidious instances failed. Please try again later.');
}

// Modified player function
async function playFromInvidious(videoId: string) {
  try {
    const { data, instance } = await fetchInvidiousData(videoId);
    const audioFormat = data.adaptiveFormats.find((format: any) => format.type.startsWith('audio/'));
    if (!audioFormat) {
      throw new Error('No audio format found');
    }
    
    const audioURL = audioFormat.url.replace(new URL(audioFormat.url).origin, instance.url);
    audio.src = audioURL;
    audio.dataset.id = videoId;
    await audio.play();
    
    // Update the selected instance in the dropdown
    const option = Array.from(invidiousInstances.options).find(opt => opt.value === instance.url);
    if (option) {
      option.selected = true;
    }
    
    notify(`Playing audio via ${instance.name}`);
  } catch (error) {
    if (error instanceof Error) {
      notify(`Error: ${error.message}`);
    } else {
      notify('An unknown error occurred');
    }
  }
}

// Instance Selector change event
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
      if (audio.dataset.id) {
        await playFromInvidious(audio.dataset.id);
        audio.currentTime = timeOfSwitch;
      }
    }
  });
});

// Create a new player function that wraps the original
export async function player(videoId: string) {
  try {
    await playFromInvidious(videoId);
  } catch (error) {
    console.error("Failed to play from Invidious instances, falling back to original player");
    await originalPlayer(videoId);
  }
}

// Export the new player function
export default player;