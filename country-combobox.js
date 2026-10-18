export function bindCountryCombobox(input, list, status, countries, onChange) {
  let matches=[], active=-1;
  const close=()=>{
    list.hidden=true;input.setAttribute('aria-expanded','false');
    input.removeAttribute('aria-activedescendant');active=-1;
  };
  const highlight=()=>{
    [...list.children].forEach((option,index)=>option.setAttribute('aria-selected',String(index===active)));
    if(active<0){input.removeAttribute('aria-activedescendant');return;}
    const option=list.children[active];input.setAttribute('aria-activedescendant',option.id);
    option.scrollIntoView({block:'nearest'});
  };
  const choose=index=>{
    if(!matches[index])return;
    input.value=matches[index].name;onChange();close();
    status.textContent=`${input.value} selected.`;
  };
  const show=(all=false)=>{
    const term=input.value.trim().toLocaleLowerCase();
    matches=countries.filter(country=>all||country.name.toLocaleLowerCase().includes(term)||country.code.toLocaleLowerCase()===term);
    active=-1;list.replaceChildren();
    for(const [index,country] of matches.entries()){
      const option=document.createElement('div');option.id=`country-option-${index}`;
      option.setAttribute('role','option');option.setAttribute('aria-selected','false');
      option.className='country-option';option.textContent=country.name;
      option.addEventListener('pointerdown',event=>event.preventDefault());
      option.addEventListener('click',()=>choose(index));list.append(option);
    }
    list.hidden=!matches.length;input.setAttribute('aria-expanded',String(!!matches.length));
    input.removeAttribute('aria-activedescendant');
    status.textContent=matches.length?`${matches.length} countries available. Use arrow keys to browse and Enter to select.`:'No matching countries. Try another name.';
  };
  input.addEventListener('focus',()=>show(countries.some(country=>country.name===input.value)));
  input.addEventListener('input',()=>{onChange();show();});
  input.addEventListener('blur',()=>{
    const match=countries.find(country=>country.name.toLocaleLowerCase()===input.value.trim().toLocaleLowerCase());
    if(match)input.value=match.name;
    close();status.textContent=match?`${match.name} selected.`:'Choose a country from the suggestions.';
  });
  input.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();close();return;}
    if(['ArrowDown','ArrowUp'].includes(event.key)){
      event.preventDefault();if(list.hidden)show();if(!matches.length)return;
      active=active<0?(event.key==='ArrowDown'?0:matches.length-1):(active+(event.key==='ArrowDown'?1:-1)+matches.length)%matches.length;
      highlight();
    }else if(event.key==='Enter'&&!list.hidden){
      event.preventDefault();if(active>=0)choose(active);else if(matches.length===1)choose(0);
    }else if(event.key==='Tab')close();
  });
  status.textContent='Type or choose a destination country.';
}
