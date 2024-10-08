import { audio, searchFilters, superInput, superModal } from "../lib/dom";
import { fetchList, params } from "../lib/utils";


const anchors = document.querySelectorAll('nav a');
const routes = ['/', '/upcoming', '/search', '/library', '/settings', '/list'];


function showSection(id: string) {
  routes.forEach((route, index) => {
    if (id === '/') id += 'home';
    if (route === '/') route += 'home';
    const section = <HTMLDivElement>document.getElementById(route.substring(1));

    if (route === id) {
      section.classList.add('view');
      anchors[index].classList.add('active');
    } else {
      section.classList.remove('view');
      anchors[index].classList.remove('active');
    }
  })
}


for (const anchor of anchors) {
  anchor.addEventListener('click', _ => {
    _.preventDefault();

    const inHome = anchor.id === '/';

    if (anchor.id !== location.pathname) {
      const sParamInHome = params.has('s') && inHome;
      const sParam = '?s=' + params.get('s');
      const otherQuery = anchor.id === '/search' ? superInput.dataset.query || '' : ''

      history.pushState({}, '',
        anchor.id + (
          sParamInHome ? sParam : otherQuery
        )
      );

      const routeName = anchor.lastElementChild?.textContent;
      const homeTitle = audio.dataset.title || 'Home';
      document.title = (
        inHome ? homeTitle : routeName
      ) + ' - scloud';
    }
    showSection(anchor.id);
  })
}

// load section if name found in address else load home
let route;
const errorParam = params.get('e');
if (errorParam) {
  if (errorParam.includes('?')) {
    const _ = errorParam.split('?');
    route = _[0];
    const query = encodeURI(_[1]);
    if (route === '/list')
      fetchList('/' + query.split('=').join('/'));
    if (route === '/search') {
      const x = new URLSearchParams(query);
      superInput.value = x.get('q') || '';
      searchFilters.value = x.get('f') || 'all';
    }
  }
  else route = errorParam;
}
else route = routes.find(route => location.pathname === route);
const anchor = <HTMLAnchorElement>document.getElementById(route || '/');
anchor.click();

// enables back button functionality

onpopstate = () =>
  superModal.open ?
    superModal.close() :
    showSection(location.pathname);
