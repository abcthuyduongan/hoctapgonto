import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const outDir = path.resolve('public/art/town');
await fs.mkdir(outDir, { recursive: true });

const BUILDINGS = [
  {
    id: 'building-cottage',
    name: 'Nhà nhỏ',
    svg: `<svg viewBox="0 0 256 256" width="256" height="256" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g-shadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#000000" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="wall-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#FFF8E7"/>
          <stop offset="100%" stop-color="#EED9B3"/>
        </linearGradient>
        <linearGradient id="roof-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FF6B4A"/>
          <stop offset="100%" stop-color="#C23B1E"/>
        </linearGradient>
      </defs>
      <!-- Shadow -->
      <ellipse cx="128" cy="224" rx="86" ry="24" fill="url(#g-shadow)"/>
      <!-- Stone Base -->
      <rect x="58" y="194" width="140" height="26" rx="6" fill="#8D99AE"/>
      <!-- House Body -->
      <rect x="68" y="120" width="120" height="78" rx="4" fill="url(#wall-grad)" stroke="#7A5C3D" stroke-width="3"/>
      <!-- Door -->
      <path d="M112,198 L112,148 Q128,138 144,148 L144,198 Z" fill="#935116" stroke="#56300E" stroke-width="2.5"/>
      <circle cx="138" cy="174" r="3" fill="#F1C40F"/>
      <!-- Window -->
      <rect x="78" y="142" width="24" height="26" rx="3" fill="#D4E6F1" stroke="#56300E" stroke-width="2.5"/>
      <line x1="90" y1="142" x2="90" y2="168" stroke="#56300E" stroke-width="2"/>
      <line x1="78" y1="155" x2="102" y2="155" stroke="#56300E" stroke-width="2"/>
      <rect x="154" y="142" width="24" height="26" rx="3" fill="#D4E6F1" stroke="#56300E" stroke-width="2.5"/>
      <line x1="166" y1="142" x2="166" y2="168" stroke="#56300E" stroke-width="2"/>
      <line x1="154" y1="155" x2="178" y2="155" stroke="#56300E" stroke-width="2"/>
      <!-- Chimney -->
      <rect x="156" y="58" width="22" height="38" rx="2" fill="#BA4A00" stroke="#6E2C00" stroke-width="2"/>
      <rect x="152" y="54" width="30" height="8" rx="2" fill="#E59866" stroke="#6E2C00" stroke-width="2"/>
      <ellipse cx="167" cy="42" rx="6" ry="4" fill="#BDC3C7" opacity="0.6"/>
      <ellipse cx="173" cy="30" rx="9" ry="6" fill="#BDC3C7" opacity="0.4"/>
      <!-- Roof -->
      <polygon points="128,52 46,128 210,128" fill="url(#roof-grad)" stroke="#78281F" stroke-width="3"/>
      <polygon points="128,62 64,122 192,122" fill="#E74C3C" opacity="0.4"/>
    </svg>`
  },
  {
    id: 'building-log-cabin',
    name: 'Nhà gỗ',
    svg: `<svg viewBox="0 0 256 256" width="256" height="256" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g-shadow-cabin" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#000000" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <!-- Shadow -->
      <ellipse cx="128" cy="224" rx="90" ry="24" fill="url(#g-shadow-cabin)"/>
      <!-- Log walls (horizontal stacked cylinders) -->
      <g stroke="#4A2810" stroke-width="2.5">
        <rect x="52" y="184" width="152" height="18" rx="8" fill="#8B4513"/>
        <rect x="56" y="168" width="144" height="18" rx="8" fill="#A0522D"/>
        <rect x="54" y="152" width="148" height="18" rx="8" fill="#8B4513"/>
        <rect x="58" y="136" width="140" height="18" rx="8" fill="#A0522D"/>
        <rect x="56" y="120" width="144" height="18" rx="8" fill="#8B4513"/>
      </g>
      <!-- Cabin Door -->
      <rect x="110" y="146" width="36" height="56" rx="4" fill="#5C2C16" stroke="#2E1408" stroke-width="2.5"/>
      <circle cx="140" cy="174" r="3" fill="#F1C40F"/>
      <!-- Small porch steps -->
      <rect x="104" y="202" width="48" height="8" rx="3" fill="#D2B48C" stroke="#4A2810" stroke-width="2"/>
      <rect x="98" y="210" width="60" height="8" rx="3" fill="#B08968" stroke="#4A2810" stroke-width="2"/>
      <!-- Log roof -->
      <polygon points="128,50 36,128 220,128" fill="#3D5A40" stroke="#1B3820" stroke-width="3"/>
      <polygon points="128,62 52,122 204,122" fill="#588157" opacity="0.6"/>
      <!-- Small attic window -->
      <circle cx="128" cy="98" r="14" fill="#FDEBD0" stroke="#3D5A40" stroke-width="3"/>
      <line x1="128" y1="84" x2="128" y2="112" stroke="#3D5A40" stroke-width="2"/>
      <line x1="114" y1="98" x2="142" y2="98" stroke="#3D5A40" stroke-width="2"/>
    </svg>`
  },
  {
    id: 'building-ancient-tree',
    name: 'Cây cổ thụ',
    svg: `<svg viewBox="0 0 256 256" width="256" height="256" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g-shadow-tree" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#000000" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <!-- Shadow -->
      <ellipse cx="128" cy="228" rx="75" ry="20" fill="url(#g-shadow-tree)"/>
      <!-- Trunk & Roots -->
      <path d="M102,228 Q114,204 116,160 L140,160 Q142,204 154,228 Z" fill="#6B4423" stroke="#42250F" stroke-width="3"/>
      <path d="M108,160 Q96,140 82,146 L86,134 Q106,136 120,154 Z" fill="#6B4423"/>
      <path d="M148,160 Q160,140 174,146 L170,134 Q150,136 136,154 Z" fill="#6B4423"/>
      <!-- Foliage clusters -->
      <circle cx="82" cy="116" r="44" fill="#2D6A4F" stroke="#1B4332" stroke-width="2.5"/>
      <circle cx="174" cy="116" r="44" fill="#2D6A4F" stroke="#1B4332" stroke-width="2.5"/>
      <circle cx="128" cy="74" r="50" fill="#40916C" stroke="#1B4332" stroke-width="3"/>
      <circle cx="112" cy="100" r="42" fill="#52B788" stroke="#1B4332" stroke-width="2"/>
      <circle cx="148" cy="104" r="40" fill="#74C69D" opacity="0.9"/>
      <!-- Bench under tree -->
      <rect x="136" y="200" width="36" height="6" rx="2" fill="#D4A373" stroke="#8C5329" stroke-width="1.5"/>
      <rect x="138" y="206" width="4" height="12" fill="#8C5329"/>
      <rect x="166" y="206" width="4" height="12" fill="#8C5329"/>
    </svg>`
  },
  {
    id: 'building-water-well',
    name: 'Giếng nước',
    svg: `<svg viewBox="0 0 256 256" width="256" height="256" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g-shadow-well" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#000000" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <!-- Shadow -->
      <ellipse cx="128" cy="226" rx="70" ry="20" fill="url(#g-shadow-well)"/>
      <!-- Stone Base -->
      <ellipse cx="128" cy="208" rx="54" ry="22" fill="#6C757D" stroke="#343A40" stroke-width="3"/>
      <path d="M74,180 L74,208 Q128,230 182,208 L182,180 Z" fill="#ADB5BD" stroke="#343A40" stroke-width="3"/>
      <ellipse cx="128" cy="180" rx="54" ry="18" fill="#495057" stroke="#343A40" stroke-width="3"/>
      <ellipse cx="128" cy="180" rx="42" ry="12" fill="#0077B6"/>
      <!-- Pillars -->
      <rect x="84" y="100" width="10" height="84" rx="3" fill="#8B4513" stroke="#4A2810" stroke-width="2"/>
      <rect x="162" y="100" width="10" height="84" rx="3" fill="#8B4513" stroke="#4A2810" stroke-width="2"/>
      <!-- Crank Beam & Rope -->
      <rect x="88" y="112" width="80" height="8" rx="2" fill="#A0522D" stroke="#4A2810" stroke-width="2"/>
      <line x1="128" y1="120" x2="128" y2="152" stroke="#D4A373" stroke-width="3"/>
      <!-- Wooden bucket -->
      <polygon points="120,152 136,152 133,166 123,166" fill="#8B4513" stroke="#4A2810" stroke-width="1.5"/>
      <!-- Well Roof -->
      <polygon points="128,68 64,106 192,106" fill="#B08968" stroke="#4A2810" stroke-width="3"/>
      <polygon points="128,76 76,102 180,102" fill="#DDB892" opacity="0.6"/>
    </svg>`
  },
  {
    id: 'building-flower-garden',
    name: 'Vườn hoa',
    svg: `<svg viewBox="0 0 256 256" width="256" height="256" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g-shadow-garden" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#000000" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <!-- Shadow -->
      <ellipse cx="128" cy="222" rx="90" ry="24" fill="url(#g-shadow-garden)"/>
      <!-- Raised planter boxes -->
      <g stroke="#582F0E" stroke-width="2.5">
        <polygon points="44,204 120,224 116,196 44,178" fill="#7F4F24"/>
        <polygon points="120,224 212,204 212,178 116,196" fill="#936639"/>
        <polygon points="44,178 116,196 212,178 140,160" fill="#4B382A"/>
      </g>
      <!-- Soil inside bed -->
      <polygon points="54,180 116,194 202,180 140,164" fill="#3D2B1F"/>
      <!-- Colorful Flowers -->
      <!-- Red Tulips -->
      <circle cx="80" cy="154" r="8" fill="#E63946"/>
      <line x1="80" y1="162" x2="80" y2="182" stroke="#2D6A4F" stroke-width="3"/>
      <circle cx="106" cy="144" r="9" fill="#E63946"/>
      <line x1="106" y1="153" x2="106" y2="186" stroke="#2D6A4F" stroke-width="3"/>
      <!-- Yellow Sunflowers -->
      <circle cx="138" cy="140" r="11" fill="#FFB703"/>
      <circle cx="138" cy="140" r="5" fill="#6A4C26"/>
      <line x1="138" y1="151" x2="138" y2="180" stroke="#2D6A4F" stroke-width="3"/>
      <!-- Bluebells / Lavender -->
      <circle cx="170" cy="148" r="8" fill="#457B9D"/>
      <line x1="170" y1="156" x2="170" y2="178" stroke="#2D6A4F" stroke-width="3"/>
      <circle cx="190" cy="160" r="7" fill="#7209B7"/>
      <line x1="190" y1="167" x2="190" y2="182" stroke="#2D6A4F" stroke-width="3"/>
      <!-- Watering can -->
      <ellipse cx="64" cy="216" rx="8" ry="6" fill="#48CAE4" stroke="#0077B6" stroke-width="1.5"/>
    </svg>`
  },
  {
    id: 'building-wooden-bridge',
    name: 'Cầu gỗ',
    svg: `<svg viewBox="0 0 256 256" width="256" height="256" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g-shadow-bridge" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#000000" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <!-- Shadow -->
      <ellipse cx="128" cy="226" rx="88" ry="22" fill="url(#g-shadow-bridge)"/>
      <!-- River stream beneath -->
      <path d="M40,214 Q128,242 216,214 Q128,198 40,214 Z" fill="#90E0EF" opacity="0.8"/>
      <!-- Stone Abutments -->
      <rect x="36" y="184" width="32" height="34" rx="4" fill="#6C757D" stroke="#343A40" stroke-width="2.5"/>
      <rect x="188" y="184" width="32" height="34" rx="4" fill="#6C757D" stroke="#343A40" stroke-width="2.5"/>
      <!-- Arch Bridge Span -->
      <path d="M48,192 Q128,140 208,192 L208,176 Q128,124 48,176 Z" fill="#8B4513" stroke="#4A2810" stroke-width="3"/>
      <!-- Planks markings -->
      <path d="M48,176 Q128,124 208,176" stroke="#D4A373" stroke-width="4" fill="none"/>
      <!-- Railings -->
      <line x1="56" y1="174" x2="56" y2="148" stroke="#5C2C16" stroke-width="3"/>
      <line x1="92" y1="156" x2="92" y2="130" stroke="#5C2C16" stroke-width="3"/>
      <line x1="128" y1="148" x2="128" y2="122" stroke="#5C2C16" stroke-width="3"/>
      <line x1="164" y1="156" x2="164" y2="130" stroke="#5C2C16" stroke-width="3"/>
      <line x1="200" y1="174" x2="200" y2="148" stroke="#5C2C16" stroke-width="3"/>
      <!-- Top Rail Bar -->
      <path d="M52,148 Q128,98 204,148" stroke="#5C2C16" stroke-width="4" fill="none"/>
    </svg>`
  },
  {
    id: 'building-mini-library',
    name: 'Thư viện mini',
    svg: `<svg viewBox="0 0 256 256" width="256" height="256" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g-shadow-lib" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#000000" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <!-- Shadow -->
      <ellipse cx="128" cy="226" rx="92" ry="24" fill="url(#g-shadow-lib)"/>
      <!-- Stone Steps -->
      <rect x="88" y="210" width="80" height="8" rx="2" fill="#CED4DA" stroke="#495057" stroke-width="2"/>
      <rect x="96" y="202" width="64" height="8" rx="2" fill="#E9ECEF" stroke="#495057" stroke-width="2"/>
      <!-- Main Building -->
      <rect x="56" y="112" width="144" height="92" rx="4" fill="#F8F9FA" stroke="#343A40" stroke-width="3"/>
      <!-- Arched Grand Door -->
      <path d="M108,202 L108,142 Q128,126 148,142 L148,202 Z" fill="#2B2D42" stroke="#1B1C2A" stroke-width="2.5"/>
      <rect x="114" y="146" width="28" height="56" fill="#8D99AE" opacity="0.3"/>
      <!-- Side Bookshelf Windows -->
      <rect x="66" y="132" width="30" height="42" rx="3" fill="#FFE8D6" stroke="#343A40" stroke-width="2"/>
      <line x1="66" y1="146" x2="96" y2="146" stroke="#343A40" stroke-width="1.5"/>
      <line x1="66" y1="160" x2="96" y2="160" stroke="#343A40" stroke-width="1.5"/>
      <rect x="160" y="132" width="30" height="42" rx="3" fill="#FFE8D6" stroke="#343A40" stroke-width="2"/>
      <line x1="160" y1="146" x2="190" y2="146" stroke="#343A40" stroke-width="1.5"/>
      <line x1="160" y1="160" x2="190" y2="160" stroke="#343A40" stroke-width="1.5"/>
      <!-- Book icon above door -->
      <polygon points="120,126 128,122 136,126 136,134 128,130 120,134" fill="#F77F00"/>
      <!-- Roof with Dome / Pediment -->
      <polygon points="128,52 44,114 212,114" fill="#0077B6" stroke="#023E8A" stroke-width="3"/>
      <polygon points="128,62 58,110 198,110" fill="#0096C7" opacity="0.5"/>
      <!-- Little flag on top -->
      <line x1="128" y1="52" x2="128" y2="34" stroke="#343A40" stroke-width="2"/>
      <polygon points="128,34 146,40 128,46" fill="#E63946"/>
    </svg>`
  },
  {
    id: 'building-village-market',
    name: 'Chợ quê',
    svg: `<svg viewBox="0 0 256 256" width="256" height="256" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g-shadow-mkt" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#000000" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <!-- Shadow -->
      <ellipse cx="128" cy="226" rx="90" ry="24" fill="url(#g-shadow-mkt)"/>
      <!-- Wooden Stall Counter -->
      <rect x="58" y="160" width="140" height="50" rx="4" fill="#B08968" stroke="#582F0E" stroke-width="3"/>
      <!-- Stall vertical poles -->
      <rect x="62" y="90" width="8" height="80" rx="2" fill="#7F4F24" stroke="#4A2810" stroke-width="2"/>
      <rect x="186" y="90" width="8" height="80" rx="2" fill="#7F4F24" stroke="#4A2810" stroke-width="2"/>
      <!-- Crates with produce -->
      <rect x="74" y="174" width="32" height="24" rx="2" fill="#DDB892" stroke="#582F0E" stroke-width="2"/>
      <circle cx="82" cy="182" r="5" fill="#E63946"/>
      <circle cx="94" cy="182" r="5" fill="#E63946"/>
      <rect x="114" y="174" width="32" height="24" rx="2" fill="#DDB892" stroke="#582F0E" stroke-width="2"/>
      <circle cx="122" cy="182" r="5" fill="#FB8500"/>
      <circle cx="134" cy="182" r="5" fill="#FB8500"/>
      <rect x="154" y="174" width="32" height="24" rx="2" fill="#DDB892" stroke="#582F0E" stroke-width="2"/>
      <ellipse cx="166" cy="182" rx="6" ry="4" fill="#48CAE4"/>
      <ellipse cx="176" cy="184" rx="6" ry="4" fill="#48CAE4"/>
      <!-- Striped Market Awning -->
      <g stroke="#8B0000" stroke-width="2">
        <polygon points="48,110 74,110 64,80 40,80" fill="#E63946"/>
        <polygon points="74,110 102,110 92,80 64,80" fill="#FFFFFF"/>
        <polygon points="102,110 130,110 120,80 92,80" fill="#E63946"/>
        <polygon points="130,110 158,110 148,80 120,80" fill="#FFFFFF"/>
        <polygon points="158,110 186,110 176,80 148,80" fill="#E63946"/>
        <polygon points="186,110 214,110 204,80 176,80" fill="#FFFFFF"/>
      </g>
      <!-- Wavy valance -->
      <path d="M48,110 Q54,120 61,110 Q68,120 74,110 Q81,120 88,110 Q95,120 102,110 Q109,120 116,110 Q123,120 130,110 Q137,120 144,110 Q151,120 158,110 Q165,120 172,110 Q179,120 186,110 Q193,120 200,110 Q207,120 214,110" fill="none" stroke="#8B0000" stroke-width="2.5"/>
    </svg>`
  },
  {
    id: 'building-windmill',
    name: 'Cối xay gió',
    svg: `<svg viewBox="0 0 256 256" width="256" height="256" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g-shadow-wind" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#000000" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <!-- Shadow -->
      <ellipse cx="128" cy="226" rx="72" ry="20" fill="url(#g-shadow-wind)"/>
      <!-- Tapered Stone Tower -->
      <polygon points="102,86 154,86 168,216 88,216" fill="#E9ECEF" stroke="#495057" stroke-width="3"/>
      <!-- Tower Door -->
      <path d="M116,216 L116,182 Q128,172 140,182 L140,216 Z" fill="#8B4513" stroke="#4A2810" stroke-width="2"/>
      <!-- Small Windows -->
      <rect x="122" y="142" width="12" height="16" rx="2" fill="#495057"/>
      <rect x="123" y="104" width="10" height="14" rx="2" fill="#495057"/>
      <!-- Conical Roof -->
      <polygon points="128,42 92,88 164,88" fill="#C23B1E" stroke="#78281F" stroke-width="3"/>
      <!-- Windmill Rotor Center -->
      <circle cx="128" cy="98" r="8" fill="#F1C40F" stroke="#4A2810" stroke-width="2.5"/>
      <!-- 4 Windmill Blades (45 degree angles) -->
      <g stroke="#4A2810" stroke-width="2" fill="#DDB892" opacity="0.95">
        <polygon points="128,94 132,94 186,40 180,36"/>
        <polygon points="132,98 132,102 186,156 190,150"/>
        <polygon points="128,102 124,102 70,156 76,160"/>
        <polygon points="124,98 124,94 70,40 66,46"/>
      </g>
    </svg>`
  },
  {
    id: 'building-bell-tower',
    name: 'Tháp chuông',
    svg: `<svg viewBox="0 0 256 256" width="256" height="256" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g-shadow-bell" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#000000" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <!-- Shadow -->
      <ellipse cx="128" cy="226" rx="64" ry="18" fill="url(#g-shadow-bell)"/>
      <!-- Tall Stone Shaft -->
      <rect x="94" y="90" width="68" height="126" rx="4" fill="#DEE2E6" stroke="#495057" stroke-width="3"/>
      <!-- Clock Face -->
      <circle cx="128" cy="148" r="16" fill="#FFF" stroke="#495057" stroke-width="2.5"/>
      <line x1="128" y1="148" x2="128" y2="138" stroke="#212529" stroke-width="2"/>
      <line x1="128" y1="148" x2="135" y2="148" stroke="#212529" stroke-width="2"/>
      <!-- Belfry Open Arch -->
      <path d="M110,118 L110,94 Q128,84 146,94 L146,118 Z" fill="#343A40" stroke="#212529" stroke-width="2"/>
      <!-- Golden Bell -->
      <path d="M120,108 Q128,98 136,108 L138,114 L118,114 Z" fill="#FFD166" stroke="#C79800" stroke-width="1.5"/>
      <circle cx="128" cy="115" r="2" fill="#E76F51"/>
      <!-- Tower Base Door -->
      <path d="M116,216 L116,190 Q128,180 140,190 L140,216 Z" fill="#6C757D"/>
      <!-- Copper Spire Roof -->
      <polygon points="128,30 84,90 172,90" fill="#2A9D8F" stroke="#1D685F" stroke-width="3"/>
      <line x1="128" y1="30" x2="128" y2="16" stroke="#E76F51" stroke-width="2.5"/>
      <circle cx="128" cy="14" r="3" fill="#E76F51"/>
    </svg>`
  },
  {
    id: 'building-street-lamp',
    name: 'Đèn đường',
    svg: `<svg viewBox="0 0 256 256" width="256" height="256" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g-shadow-lamp" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#000000" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="g-lamp-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#FFD166" stop-opacity="0.9"/>
          <stop offset="60%" stop-color="#FFB703" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="#FB8500" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <!-- Shadow -->
      <ellipse cx="128" cy="228" rx="42" ry="14" fill="url(#g-shadow-lamp)"/>
      <!-- Stone Pedestal Base -->
      <rect x="108" y="210" width="40" height="14" rx="3" fill="#6C757D" stroke="#343A40" stroke-width="2.5"/>
      <rect x="114" y="198" width="28" height="14" rx="2" fill="#ADB5BD" stroke="#343A40" stroke-width="2"/>
      <!-- Cast iron post -->
      <rect x="124" y="96" width="8" height="104" rx="2" fill="#212529" stroke="#101214" stroke-width="2"/>
      <!-- Glow halo -->
      <circle cx="128" cy="80" r="42" fill="url(#g-lamp-glow)"/>
      <!-- Lantern Housing -->
      <polygon points="112,68 144,68 138,96 118,96" fill="#FFF3B0" stroke="#212529" stroke-width="2.5"/>
      <line x1="128" y1="68" x2="128" y2="96" stroke="#212529" stroke-width="2"/>
      <!-- Lantern Top Cap & Finial -->
      <polygon points="128,46 108,68 148,68" fill="#212529" stroke="#101214" stroke-width="2.5"/>
      <circle cx="128" cy="44" r="3" fill="#212529"/>
      <!-- Hanging Flower Basket on post -->
      <path d="M124,136 Q108,136 104,148 L104,158 L124,158 Z" fill="#8B4513" stroke="#4A2810" stroke-width="1.5"/>
      <circle cx="112" cy="144" r="4" fill="#E63946"/>
      <circle cx="118" cy="142" r="3" fill="#FFB703"/>
    </svg>`
  },
  {
    id: 'building-fishing-dock',
    name: 'Bến cá',
    svg: `<svg viewBox="0 0 256 256" width="256" height="256" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g-shadow-dock" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#000000" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <!-- Shadow -->
      <ellipse cx="128" cy="226" rx="90" ry="24" fill="url(#g-shadow-dock)"/>
      <!-- Water Surface -->
      <path d="M40,210 Q128,236 216,210 Q128,190 40,210 Z" fill="#48CAE4" opacity="0.8"/>
      <!-- Wooden Dock Piles -->
      <rect x="64" y="160" width="10" height="56" rx="2" fill="#582F0E" stroke="#3D2008" stroke-width="2"/>
      <rect x="124" y="160" width="10" height="56" rx="2" fill="#582F0E" stroke="#3D2008" stroke-width="2"/>
      <rect x="182" y="160" width="10" height="56" rx="2" fill="#582F0E" stroke="#3D2008" stroke-width="2"/>
      <!-- Dock Planks Platform -->
      <polygon points="50,166 196,166 188,150 58,150" fill="#B08968" stroke="#582F0E" stroke-width="2.5"/>
      <!-- Wooden Mooring Bollard -->
      <rect x="60" y="136" width="8" height="18" rx="2" fill="#7F4F24" stroke="#3D2008" stroke-width="1.5"/>
      <!-- Tied Rowing Boat -->
      <path d="M120,186 Q160,204 196,186 Q160,172 120,186 Z" fill="#DDB892" stroke="#582F0E" stroke-width="2.5"/>
      <!-- Fish Crate on Dock -->
      <rect x="86" y="140" width="24" height="14" rx="2" fill="#D4A373" stroke="#582F0E" stroke-width="1.5"/>
      <ellipse cx="98" cy="144" rx="6" ry="3" fill="#0077B6"/>
      <!-- Fishing Rod leaning -->
      <line x1="168" y1="120" x2="148" y2="164" stroke="#8C5329" stroke-width="2"/>
      <line x1="168" y1="120" x2="176" y2="190" stroke="#FFF" stroke-width="1" opacity="0.7"/>
    </svg>`
  }
];

async function generateAll() {
  console.log(`Generating ${BUILDINGS.length} town building assets...`);
  for (const b of BUILDINGS) {
    const filename = `${b.id}.webp`;
    const targetPath = path.join(outDir, filename);
    const buf = await sharp(Buffer.from(b.svg))
      .webp({ quality: 90, alphaQuality: 100, lossless: false })
      .toBuffer();
    
    await fs.writeFile(targetPath, buf);
    const stat = await fs.stat(targetPath);
    console.log(`  ✓ ${filename}: ${stat.size} bytes (${(stat.size / 1024).toFixed(1)} KB)`);
  }
}

await generateAll();
