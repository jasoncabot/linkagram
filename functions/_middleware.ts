import { initWasm, Resvg } from "@resvg/resvg-wasm";

export interface Env {
}

export async function onRequest(context: {
  request: Request;
  next: () => Promise<Response>;
  env: Env;
}): Promise<Response> {
  const { request, next } = context;
  const { pathname, origin } = new URL(request.url);

  if (pathname === "/assets/sample.png") {
    const svg = `<?xml version="1.0" standalone="no"?>
    <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
    <svg width="165" height="165" version="1.1" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="165" height="165" fill="#bbe0e3" stroke="none" />
    <path fill="black" stroke="none" d="M0 0 L0 165 L165 165 L165 0 L0 0 z M1 1 L41 1 L41 41 L1 41 L1 1 z M42 1 L82 1 L82 41 L42 41 L42 1 z M83 1 L123 1 L123 41 L83 41 L83 1 z M124 1 L164 1 L164 41 L124 41 L124 1 z M20.90625 11 C19.495125 11.000018 18.279047 11.199178 17.28125 11.625 C16.283444 12.050858 15.53021 12.68591 15 13.5 C14.469785 14.314122 14.187498 15.189835 14.1875 16.125 C14.187498 17.57788 14.747773 18.802183 15.875 19.8125 C16.676578 20.530593 18.075239 21.13237 20.0625 21.625 C21.607206 22.009099 22.59705 22.287211 23.03125 22.4375 C23.665825 22.662952 24.120319 22.913988 24.375 23.21875 C24.629657 23.523524 24.749988 23.909565 24.75 24.34375 C24.749988 25.020089 24.449099 25.61984 23.84375 26.125 C23.238378 26.630166 22.350263 26.875003 21.15625 26.875 C20.029017 26.875003 19.132554 26.599041 18.46875 26.03125 C17.804935 25.463467 17.37334 24.554478 17.15625 23.34375 L13.53125 23.6875 C13.773393 25.741558 14.505876 27.302051 15.75 28.375 C16.994118 29.447951 18.803746 30 21.125 30 C22.719805 30 24.024963 29.790465 25.09375 29.34375 C26.162513 28.897035 27.009248 28.199731 27.59375 27.28125 C28.178221 26.362774 28.468734 25.364581 28.46875 24.3125 C28.468734 23.151882 28.207199 22.195315 27.71875 21.40625 C27.230271 20.617201 26.551692 19.986325 25.6875 19.53125 C24.823282 19.076196 23.491049 18.644602 21.6875 18.21875 C19.883933 17.792922 18.748834 17.392453 18.28125 17 C17.913853 16.69107 17.749995 16.309203 17.75 15.875 C17.749995 15.399075 17.951303 15.002658 18.34375 14.71875 C18.95328 14.276225 19.797867 14.062516 20.875 14.0625 C21.918717 14.062516 22.696877 14.274199 23.21875 14.6875 C23.740602 15.10083 24.060092 15.775235 24.21875 16.71875 L27.9375 16.5625 C27.879036 14.875853 27.258535 13.510343 26.09375 12.5 C24.928939 11.48969 23.210788 11.000018 20.90625 11 z M143.96875 11 C142.47412 11.000018 141.17517 11.23448 140.03125 11.71875 C139.17121 12.07781 138.37851 12.631884 137.65625 13.375 C136.93399 14.118149 136.35499 14.971086 135.9375 15.90625 C135.37806 17.175434 135.09375 18.723403 135.09375 20.59375 C135.09375 23.516191 135.88849 25.834216 137.5 27.5 C139.11151 29.165788 141.30085 30 144.03125 30 C146.72823 30 148.88848 29.142888 150.5 27.46875 C152.1115 25.794616 152.90623 23.49544 152.90625 20.53125 C152.90623 17.542029 152.09277 15.209577 150.46875 13.53125 C148.84469 11.852956 146.67408 11.000018 143.96875 11 z M54.71875 11.3125 L54.71875 29.6875 L58.15625 29.6875 L58.15625 17.6875 L65.5625 29.6875 L69.28125 29.6875 L69.28125 11.3125 L65.84375 11.3125 L65.84375 23.5625 L58.3125 11.3125 L54.71875 11.3125 z M94.71875 11.3125 L94.71875 29.6875 L98.4375 29.6875 L98.4375 24.125 L101.4375 21.0625 L106.46875 29.6875 L111.28125 29.6875 L104 18.46875 L110.90625 11.3125 L105.90625 11.3125 L98.4375 19.46875 L98.4375 11.3125 L94.71875 11.3125 z M144 14.15625 C145.52801 14.156265 146.76483 14.683388 147.6875 15.71875 C148.61014 16.75414 149.06249 18.333358 149.0625 20.4375 C149.06249 22.566709 148.60394 24.154155 147.65625 25.21875 C146.70854 26.283355 145.47791 26.812503 144 26.8125 C142.52208 26.812503 141.30397 26.291704 140.34375 25.21875 C139.38351 24.145804 138.90625 22.54786 138.90625 20.46875 C138.90625 18.356258 139.37732 16.797915 140.3125 15.75 C141.24767 14.702114 142.47198 14.156265 144 14.15625 z M1 42 L41 42 L41 82 L1 82 L1 42 z M42 42 L82 42 L82 82 L42 82 L42 42 z M83 42 L123 42 L123 82 L83 82 L83 42 z M124 42 L164 42 L164 82 L124 82 L124 42 z M12.4375 52.3125 L19 70.6875 L22.96875 70.6875 L29.5625 52.3125 L25.625 52.3125 L21.125 65.90625 L16.46875 52.3125 L12.4375 52.3125 z M53.75 52.3125 L53.75 70.6875 L57.46875 70.6875 L57.46875 63 L58.21875 63 C59.070423 63.000007 59.670051 63.080985 60.0625 63.21875 C60.454933 63.356529 60.836799 63.597191 61.1875 63.96875 C61.538183 64.340323 62.173111 65.259687 63.125 66.6875 L65.8125 70.6875 L70.25 70.6875 L68 67.09375 C67.114904 65.665937 66.428099 64.684444 65.90625 64.125 C65.384373 63.56557 64.707819 63.030098 63.90625 62.5625 C65.51775 62.328714 66.752553 61.772614 67.5625 60.875 C68.372415 59.977406 68.749983 58.846481 68.75 57.46875 C68.749983 56.383288 68.503121 55.405847 67.96875 54.5625 C67.434346 53.719186 66.70174 53.142335 65.8125 52.8125 C64.923232 52.482701 63.524695 52.312518 61.5625 52.3125 L53.75 52.3125 z M96.03125 52.3125 L96.03125 70.6875 L109.96875 70.6875 L109.96875 67.59375 L99.71875 67.59375 L99.71875 62.59375 L108.9375 62.59375 L108.9375 59.5 L99.71875 59.5 L99.71875 55.40625 L109.625 55.40625 L109.625 52.3125 L96.03125 52.3125 z M135.75 52.3125 L135.75 70.6875 L139.46875 70.6875 L139.46875 63 L140.21875 63 C141.07042 63.000007 141.67005 63.080985 142.0625 63.21875 C142.45493 63.356529 142.8368 63.597191 143.1875 63.96875 C143.53818 64.340323 144.17311 65.259687 145.125 66.6875 L147.8125 70.6875 L152.25 70.6875 L150 67.09375 C149.11491 65.665937 148.4281 64.684444 147.90625 64.125 C147.38437 63.56557 146.70782 63.030098 145.90625 62.5625 C147.51775 62.328714 148.75255 61.772614 149.5625 60.875 C150.37242 59.977406 150.74998 58.846481 150.75 57.46875 C150.74998 56.383288 150.50312 55.405847 149.96875 54.5625 C149.43434 53.719186 148.70174 53.142335 147.8125 52.8125 C146.92323 52.482701 145.52469 52.312518 143.5625 52.3125 L135.75 52.3125 z M57.46875 55.40625 L60.34375 55.40625 C61.846706 55.40626 62.761896 55.42702 63.0625 55.46875 C63.663675 55.568963 64.10767 55.807598 64.4375 56.1875 C64.767304 56.567431 64.937487 57.069628 64.9375 57.6875 C64.937487 58.2386 64.812981 58.695121 64.5625 59.0625 C64.311993 59.429903 63.973778 59.693464 63.53125 59.84375 C63.088698 59.994055 61.966 60.093761 60.1875 60.09375 L57.46875 60.09375 L57.46875 55.40625 z M139.46875 55.40625 L142.34375 55.40625 C143.8467 55.40626 144.76189 55.42702 145.0625 55.46875 C145.66367 55.568963 146.10767 55.807598 146.4375 56.1875 C146.76731 56.567431 146.93749 57.069628 146.9375 57.6875 C146.93749 58.2386 146.81298 58.695121 146.5625 59.0625 C146.31199 59.429903 145.97378 59.693464 145.53125 59.84375 C145.0887 59.994055 143.966 60.093761 142.1875 60.09375 L139.46875 60.09375 L139.46875 55.40625 z M1 83 L41 83 L41 123 L1 123 L1 83 z M42 83 L82 83 L82 123 L42 123 L42 83 z M83 83 L123 83 L123 123 L83 123 L83 83 z M124 83 L164 83 L164 123 L124 123 L124 83 z M19.15625 93.3125 L19.15625 111.6875 L22.84375 111.6875 L22.84375 93.3125 L19.15625 93.3125 z M54.3125 93.3125 L54.3125 111.6875 L61.28125 111.6875 C62.65061 111.6875 63.744207 111.5401 64.5625 111.28125 C65.656313 110.93056 66.5133 110.43874 67.15625 109.8125 C68.007915 108.98587 68.665744 107.89847 69.125 106.5625 C69.500725 105.46868 69.687482 104.16758 69.6875 102.65625 C69.687482 100.9362 69.494524 99.516911 69.09375 98.34375 C68.692943 97.170616 68.111917 96.153697 67.34375 95.34375 C66.575553 94.533835 65.639613 93.97356 64.5625 93.65625 C63.760906 93.422473 62.621756 93.312518 61.09375 93.3125 L54.3125 93.3125 z M101.15625 93.3125 L101.15625 111.6875 L104.84375 111.6875 L104.84375 93.3125 L101.15625 93.3125 z M136.71875 93.3125 L136.71875 111.6875 L140.15625 111.6875 L140.15625 99.6875 L147.5625 111.6875 L151.28125 111.6875 L151.28125 93.3125 L147.84375 93.3125 L147.84375 105.5625 L140.3125 93.3125 L136.71875 93.3125 z M58 96.40625 L59.6875 96.40625 C61.198808 96.406265 62.201052 96.476868 62.71875 96.59375 C63.411774 96.744062 63.986599 97.042924 64.4375 97.46875 C64.888377 97.894604 65.249493 98.49018 65.5 99.25 C65.750482 100.00984 65.874987 101.08054 65.875 102.5 C65.874987 103.91948 65.750482 105.05255 65.5 105.875 C65.249493 106.69746 64.927853 107.29721 64.53125 107.65625 C64.134622 108.01529 63.632425 108.25595 63.03125 108.40625 C62.572 108.52319 61.816617 108.59375 60.78125 108.59375 L58 108.59375 L58 96.40625 z M1 124 L41 124 L41 164 L1 164 L1 124 z M42 124 L82 124 L82 164 L42 164 L42 124 z M83 124 L123 124 L123 164 L83 164 L83 124 z M124 124 L164 124 L164 164 L124 164 L124 124 z M103.53125 134 C101.77778 134.00002 100.30231 134.29674 99.125 134.90625 C97.58028 135.6995 96.426579 136.8575 95.625 138.34375 C94.823416 139.83003 94.406249 141.52541 94.40625 143.4375 C94.406249 145.19932 94.781914 146.81371 95.5 148.3125 C96.218081 149.81129 97.290928 150.97549 98.71875 151.78125 C100.14656 152.58701 101.79828 153 103.71875 153 C105.23005 153 106.74499 152.69696 108.21875 152.125 C109.69247 151.55304 110.8172 150.90774 111.59375 150.15625 L111.59375 142.84375 L103.59375 142.84375 L103.59375 145.9375 L107.84375 145.9375 L107.84375 148.25 C107.2843 148.6842 106.62444 149.07023 105.84375 149.375 C105.06303 149.67977 104.27652 149.8125 103.5 149.8125 C101.93023 149.8125 100.65608 149.27715 99.6875 148.1875 C98.718916 147.09785 98.218745 145.46056 98.21875 143.28125 C98.218745 141.2606 98.700191 139.74579 99.65625 138.71875 C100.61229 137.69174 101.91138 137.15627 103.53125 137.15625 C104.60002 137.15627 105.50483 137.41565 106.21875 137.9375 C106.93265 138.45938 107.39739 139.19199 107.65625 140.09375 L111.34375 139.40625 C110.97634 137.71961 110.15668 136.39357 108.875 135.4375 C107.59329 134.48146 105.81074 134.00002 103.53125 134 z M13.71875 134.3125 L13.71875 152.6875 L17.15625 152.6875 L17.15625 140.6875 L24.5625 152.6875 L28.28125 152.6875 L28.28125 134.3125 L24.84375 134.3125 L24.84375 146.5625 L17.3125 134.3125 L13.71875 134.3125 z M55.03125 134.3125 L55.03125 152.6875 L68.96875 152.6875 L68.96875 149.59375 L58.71875 149.59375 L58.71875 144.59375 L67.9375 144.59375 L67.9375 141.5 L58.71875 141.5 L58.71875 137.40625 L68.625 137.40625 L68.625 134.3125 L55.03125 134.3125 z M136.6875 134.3125 L136.6875 144.09375 C136.68749 146.14781 136.78911 147.72918 137.03125 148.78125 C137.19825 149.49099 137.56771 150.16539 138.09375 150.8125 C138.61979 151.45961 139.3128 151.97003 140.21875 152.375 C141.1247 152.77996 142.46528 153 144.21875 153 C145.6716 153 146.84821 152.80906 147.75 152.4375 C148.65176 152.06593 149.36768 151.56374 149.90625 150.9375 C150.4448 150.31127 150.83084 149.53514 151.03125 148.625 C151.23163 147.71488 151.31249 146.17311 151.3125 143.96875 L151.3125 134.3125 L147.625 134.3125 L147.625 144.46875 C147.62498 145.92162 147.54603 146.96752 147.4375 147.59375 C147.32894 148.21999 147.03438 148.75749 146.5 149.1875 C145.9656 149.61752 145.14581 149.8125 144.09375 149.8125 C143.05836 149.8125 142.25326 149.58007 141.65625 149.125 C141.05923 148.66994 140.68989 148.06399 140.53125 147.3125 C140.43937 146.84492 140.375 145.82812 140.375 144.25 L140.375 134.3125 L136.6875 134.3125 z " />
    </svg>`;

    // The Wasm must be initialized first
    await initWasm(fetch(origin + '/wasm/resvg.wasm'));

    const resvgJS = new Resvg(svg, {
      fitTo: {
        mode: "width",
        value: 800
      },
    })
    const pngData = resvgJS.render();
    const pngBuffer = pngData.asPng();

    return new Response(pngBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store'
      }
    });
  }

  console.log(pathname);
  // Otherwise just pass request through
  return next();
}
