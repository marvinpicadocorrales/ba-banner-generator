// ─────────────────────────────────────────────────────────────────────────────
// BA Banner Generator – Figma Plugin (code.js)
// Runs in the Figma plugin sandbox (QuickJS – ES6 only, no ??, no ?.)
//
// EXPORT STRATEGY: per-layer PNG exports.
// Each direct child of a banner frame is exported as its own PNG.
// Layers whose PNG changes between scenes  → cross-fade in HTML (.sc-N classes)
// Layers whose PNG is identical in all scenes → always visible (static)
//
// PREREQUISITE: Any layer whose artwork bleeds outside the artboard bounds
// (e.g. "Export Keyart here") must be a Frame the same size as the artboard
// with Clip Content ON. The plugin then exports the correct W×H PNG directly.
// ─────────────────────────────────────────────────────────────────────────────

figma.showUI(__html__, { width: 480, height: 870, title: 'BA Banner Generator v1.5' });

var stopRequested = false;

// ── All standard BA banner sizes ──────────────────────────────────────────────
const KNOWN_SIZES = [
  { w: 300, h: 600 },
  { w: 160, h: 600 },
  { w: 320, h: 480 },
  { w: 300, h: 250 },
  { w: 320, h: 50  },
  { w: 300, h: 50  },
  { w: 728, h: 90  },
];

// ── Layer role patterns ───────────────────────────────────────────────────────
// Layers matching STATIC_UI become always-visible overlays.
//   LOGO_PATTERNS  → no animation
//   CTA_PATTERNS   → ctaPulse animation
// Layers matching OVERLAY are persistent shadow/gradient overlays — always
// visible and always rendered above the video layer.
// Everything else is a scene/bg layer (hash-compared, may cross-fade).

const STATIC_UI_PATTERNS = [/^cta\s*\+\s*logo/i, /^cta$/i, /^cta\s+(bof|tof|mof)$/i, /^ba_logo/i, /^logo/i];
const LOGO_PATTERNS      = [/^ba_logo/i, /logo/i];
const VIDEO_PATTERNS     = [/\.webm$/i, /video/i];
const SCENE_PATTERNS     = [/^master/i, /master\s*\(/i];
// Shadow / gradient overlay layers — always static, keyed by position so that
// same-purpose layers with different names across scenes (e.g. "Rectangle 7"
// in scene 1 and "Rectangle 8" in scene 2) are merged into one persistent layer.
const OVERLAY_PATTERNS   = [
  /^shadow/i,            // Shadow Right, Shadow Top, Shadow Bottom…
  /^gradiente?$/i,       // Gradient, Gradiente
  /^overlay/i,           // Overlay_*
  /^Rectangle\s*\d+$/i, // Figma auto-names: Rectangle 2, Rectangle 7, Rectangle 8…
];

function matchesAny(name, patterns) {
  return patterns.some(function(p) { return p.test(name); });
}

function getLayerRole(name) {
  if (matchesAny(name, STATIC_UI_PATTERNS)) return 'static-ui';
  if (matchesAny(name, VIDEO_PATTERNS))     return 'video';
  if (matchesAny(name, OVERLAY_PATTERNS))   return 'overlay';
  if (matchesAny(name, SCENE_PATTERNS))     return 'scene';
  return 'bg';
}

// 'logo' = no animation  |  'cta' = ctaPulse animation
function getStaticUiSubRole(name) {
  return matchesAny(name, LOGO_PATTERNS) ? 'logo' : 'cta';
}

// ── Parse "[FUNNEL] - [CopyCode]" from a Figma Section name ──────────────────
// e.g. "TOF - 500WB"    → { funnel:'TOF', copyCode:'500WB' }
//      "MOF - 40FS"     → { funnel:'MOF', copyCode:'40FS'  }
//      "BOF COPY 1"     → { funnel:'BOF', copyCode:'BOF-COPY-1' }  (Figma duplicate)
//      "My Section"     → { funnel:'XX',  copyCode:'My-Section' }
// Spaces in copyCode are replaced with hyphens for safe filenames.
var KNOWN_FUNNELS = ['TOF', 'MOF', 'BOF'];
function parseSectionName(name) {
  var trimmed = name.trim();
  // Primary: explicit " - " separator
  var dash = trimmed.indexOf(' - ');
  if (dash !== -1) {
    return {
      funnel:   trimmed.substring(0, dash).trim().toUpperCase(),
      copyCode: trimmed.substring(dash + 3).trim().replace(/\s+/g, '-'),
    };
  }
  // Fallback: detect known funnel code at the start of the name
  var upper = trimmed.toUpperCase();
  for (var i = 0; i < KNOWN_FUNNELS.length; i++) {
    if (upper.indexOf(KNOWN_FUNNELS[i]) === 0) {
      var rest = trimmed.substring(KNOWN_FUNNELS[i].length).trim();
      return {
        funnel:   KNOWN_FUNNELS[i],
        copyCode: (rest || trimmed).replace(/\s+/g, '-'),
      };
    }
  }
  return { funnel: 'XX', copyCode: trimmed.replace(/\s+/g, '-') };
}

// ── Scan a given root node for banner frames ──────────────────────────────────
// Returns { [sizeKey]: [{id:string, name:string}, ...] }
//
// CRITICAL: walk uses `'children' in node` (not direct .children access).
// Accessing .children on a Figma leaf-node proxy (TextNode, RectangleNode…)
// that does not own the property triggers a getPropStr/deepUnwrap WASM abort.
// The `in` operator calls hasProp which safely returns false without aborting.
function scanForBanners(rootNode) {
  var banners = {};

  function walk(node) {
    if (
      node.visible !== false &&
      (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') &&
      KNOWN_SIZES.some(function(s) {
        return Math.round(node.width) === s.w && Math.round(node.height) === s.h;
      })
    ) {
      var nameMatch = node.name.match(/^(\d+)[x\u00d7](\d+)p?x?[_\-\s]/i);
      if (nameMatch) {
        var key = nameMatch[1] + 'x' + nameMatch[2];
        if (!banners[key]) banners[key] = [];
        banners[key].push({ id: String(node.id), name: String(node.name) });
      }
      return; // never recurse into matched banner frames
    }
    // Use 'in' operator — not direct .children access — to guard leaf nodes.
    if ('children' in node) {
      for (var i = 0; i < node.children.length; i++) walk(node.children[i]);
    }
  }

  walk(rootNode);

  for (var key in banners) {
    banners[key].sort(function(a, b) {
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    });
  }
  return banners;
}

// ── Walk the page and collect frames matching banner sizes ────────────────────
function scanPage() {
  return scanForBanners(figma.currentPage);
}

// ── Detect Figma Sections, parse funnel+copyCode, collect their banners ───────
// Returns { hasSections, sections:[{id,name,funnel,copyCode,banners}], flatBanners }
// If no SectionNodes exist at page-root level, hasSections=false and flatBanners
// falls back to a full scanPage().
// ── Read execution type from "Control Panel" section ─────────────────────────
// Looks for a section named "Control Panel" (case-insensitive) at page root,
// then finds a TEXT node named "vertical" (case-insensitive) and returns its
// trimmed text lowercased.
// ── Read a named TEXT layer from "Control Panel" section ─────────────────────
function readControlPanelField(fieldName) {
  var page = figma.currentPage;
  for (var i = 0; i < page.children.length; i++) {
    var child = page.children[i];
    if (child.type === 'SECTION' && child.name.trim().toLowerCase() === 'control panel') {
      function findField(node) {
        if (node.type === 'TEXT' && node.name.trim().toLowerCase() === fieldName && node.characters && node.characters.trim()) {
          return node.characters.trim();
        }
        if ('children' in node) {
          for (var ci = 0; ci < node.children.length; ci++) {
            var found = findField(node.children[ci]);
            if (found) return found;
          }
        }
        return null;
      }
      return findField(child);
    }
  }
  return null;
}

function readExecutionType() {
  var val = readControlPanelField('vertical');
  return val ? val.toLowerCase() : null;
}

function scanSections() {
  var page     = figma.currentPage;
  var sections = [];
  var flatBanners = {};

  for (var i = 0; i < page.children.length; i++) {
    var child = page.children[i];
    if (child.type === 'SECTION' && child.name.trim().toLowerCase() !== 'control panel') {
      var parsed  = parseSectionName(child.name);
      var banners = scanForBanners(child);
      sections.push({
        id:       child.id,
        name:     child.name,
        funnel:   parsed.funnel,
        copyCode: parsed.copyCode,
        banners:  banners,
      });
      // Accumulate into flat union
      for (var key in banners) {
        if (!flatBanners[key]) flatBanners[key] = [];
        for (var j = 0; j < banners[key].length; j++) {
          flatBanners[key].push(banners[key][j]);
        }
      }
    }
  }

  if (sections.length === 0) {
    return { hasSections: false, sections: [], flatBanners: scanPage() };
  }
  return { hasSections: true, sections: sections, flatBanners: flatBanners };
}

// ── Background color ──────────────────────────────────────────────────────────
function getFrameBgColor(node) {
  var fills = (node.backgrounds !== undefined && node.backgrounds !== null)
    ? node.backgrounds
    : (node.fills !== undefined && node.fills !== null) ? node.fills : [];
  var solid = fills.find(function(f) { return f.type === 'SOLID' && f.visible !== false; });
  if (solid) {
    var r = solid.color.r, g = solid.color.g, b = solid.color.b;
    var a = (solid.opacity !== undefined && solid.opacity !== null) ? solid.opacity : 1;
    return 'rgba(' + Math.round(r*255) + ',' + Math.round(g*255) + ',' + Math.round(b*255) + ',' + a + ')';
  }
  return '#000000';
}

// ── Check if a node (or any descendant) has a VIDEO fill ─────────────────────
// Used to identify video containers in each scene frame by content, not by name
// (scene groups are named "Master (1)", "Master (2)"… — names differ per frame).
function nodeHasVideoFill(node) {
  if (node.fills && node.fills.length) {
    for (var fi = 0; fi < node.fills.length; fi++) {
      if (node.fills[fi].type === 'VIDEO') return true;
    }
  }
  if ('children' in node) {
    for (var ci = 0; ci < node.children.length; ci++) {
      if (nodeHasVideoFill(node.children[ci])) return true;
    }
  }
  return false;
}

// ── Video layer detection ─────────────────────────────────────────────────────
function hasVideoLayer(frameNode) {
  if (!('children' in frameNode)) return false;
  function check(node) {
    // Primary: VIDEO fill type (Figma native video fill)
    if (node.fills && node.fills.length) {
      for (var fi = 0; fi < node.fills.length; fi++) {
        if (node.fills[fi].type === 'VIDEO') return true;
      }
    }
    // Fallback: MEDIA node type or name-based detection
    if (node.type === 'MEDIA' || (node.name && VIDEO_PATTERNS.some(function(p) { return p.test(node.name); }))) return true;
    if ('children' in node) {
      for (var i = 0; i < node.children.length; i++) if (check(node.children[i])) return true;
    }
    return false;
  }
  return check(frameNode);
}

// ── Find deepest node with a VIDEO fill ──────────────────────────────────────
// Returns { nodeId, nodeName, topLevelParentName, topLevelParentId, x, y, w, h, videoHash }
// x/y are CSS pixels relative to the frame's top-left corner.
// Returns null if no VIDEO fill is found anywhere in the frame tree.
function findVideoFillNode(frameNode) {
  if (!('children' in frameNode)) return null;
  var frameX = frameNode.absoluteBoundingBox ? frameNode.absoluteBoundingBox.x : 0;
  var frameY = frameNode.absoluteBoundingBox ? frameNode.absoluteBoundingBox.y : 0;

  function searchDeep(node) {
    if (node.fills && node.fills.length) {
      for (var fi = 0; fi < node.fills.length; fi++) {
        var fill = node.fills[fi];
        if (fill.type === 'VIDEO' && fill.videoHash) {
          var bb = node.absoluteBoundingBox;
          if (bb) {
            return {
              nodeId:    String(node.id),
              nodeName:  String(node.name),
              x:         Math.round(bb.x - frameX),
              y:         Math.round(bb.y - frameY),
              w:         Math.round(bb.width),
              h:         Math.round(bb.height),
              videoHash: String(fill.videoHash),
            };
          }
        }
      }
    }
    if ('children' in node) {
      for (var ci = 0; ci < node.children.length; ci++) {
        var found = searchDeep(node.children[ci]);
        if (found) return found;
      }
    }
    return null;
  }

  for (var i = 0; i < frameNode.children.length; i++) {
    var child = frameNode.children[i];
    var found = searchDeep(child);
    if (found) {
      found.topLevelParentName = String(child.name);
      found.topLevelParentId   = String(child.id);
      return found;
    }
  }
  return null;
}

// ── Uint8Array → base64 string ────────────────────────────────────────────────
// Sending raw byte arrays via figma.ui.postMessage causes a WASM abort in
// Figma's deepUnwrap serialiser when arrays contain tens of thousands of
// elements.  A base64 string is a single primitive — no recursion needed.
// Uses array accumulation + join for performance (avoids repeated string alloc).
function toBase64(uint8) {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var out = [];
  var len = uint8.length;
  for (var i = 0; i < len; i += 3) {
    var b0 = uint8[i];
    var b1 = i + 1 < len ? uint8[i + 1] : 0;
    var b2 = i + 2 < len ? uint8[i + 2] : 0;
    out.push(chars[b0 >> 2]);
    out.push(chars[((b0 & 3) << 4) | (b1 >> 4)]);
    out.push(i + 1 < len ? chars[((b1 & 15) << 2) | (b2 >> 6)] : '=');
    out.push(i + 2 < len ? chars[b2 & 63] : '=');
  }
  return out.join('');
}

// ── Read width/height from PNG IHDR chunk (bytes 16-23) ──────────────────────
function getPNGDimensions(bytes) {
  var w = (bytes[16] * 16777216) + (bytes[17] * 65536) + (bytes[18] * 256) + bytes[19];
  var h = (bytes[20] * 16777216) + (bytes[21] * 65536) + (bytes[22] * 256) + bytes[23];
  return { w: w, h: h };
}

// ── Fast hash for PNG change-detection (samples ~500 bytes) ──────────────────
function simpleHash(arr) {
  var h    = 5381;
  var step = Math.max(1, Math.floor(arr.length / 500));
  for (var i = 0; i < arr.length; i += step) {
    h = ((h << 5) + h + arr[i]) | 0;
  }
  return h;
}

// ── Export one child layer and compute its CSS position ──────────────────────
// Returns { x, y, w, h, png, hash }
// x/y/w/h are 1× CSS pixels, adjusted for effect overflow (glow, shadow, etc.)
// so the div can be placed precisely in the banner HTML.
async function exportChildLayer(child, scale, frameH) {
  var cx  = Math.round(child.x);
  var cy  = Math.round(child.y);
  var cdw = Math.round(child.width);
  var cdh = Math.round(child.height);

  var bytes = await child.exportAsync({
    format:     'PNG',
    constraint: { type: 'SCALE', value: scale },
  });

  var dims = getPNGDimensions(bytes);
  var hash = simpleHash(bytes);    // hash from raw bytes before base64 encoding
  var png  = toBase64(bytes);      // convert to string — safe for postMessage

  // Convert back to 1× CSS pixels
  var pngW = Math.round(dims.w / scale);
  var pngH = Math.round(dims.h / scale);

  // Use absoluteRenderBounds for effect-based position correction on most
  // nodes (instances, frames, shapes). TEXT nodes are special: their render
  // bounds can include sub-pixel/anti-aliasing overflow that mis-positions
  // rotated or edge-placed text. For TEXT, use the bounding box position and
  // clamp to the frame boundary so the full text stays visible.
  var rx, ry;
  var abb = child.absoluteBoundingBox;
  var arb = child.absoluteRenderBounds;
  if (child.type === 'TEXT' && (child.name === 'T&C Apply' || child.name === 'T&Cs Apply') && (frameH === 90 || frameH === 50)) {
    // "T&C Apply" disclaimer on 728x90, 320x50 and 300x50 — center vertically.
    rx = cx;
    ry = Math.round((frameH - pngH) / 2);
  } else if (child.type === 'TEXT') {
    rx = cx;
    ry = cy;
    if (ry + pngH > frameH) {
      ry = frameH - pngH;
    }
  } else if (abb && arb) {
    rx = cx + Math.round(arb.x - abb.x);
    ry = cy + Math.round(arb.y - abb.y);
  } else {
    rx = cx;
    ry = cy;
  }

  return {
    x:    rx,
    y:    ry,
    w:    pngW,
    h:    pngH,
    png:  png,    // base64 string
    hash: hash,
  };
}

// ── Composite overlay export ──────────────────────────────────────────────────
// Shadow layers like "Shadow Right" / "Shadow Top" are positioned OUTSIDE the
// banner frame (e.g. y=251 in a 250px frame) with their drop shadow effect
// extending INTO the frame.  Exporting them individually via exportAsync clips
// the node to its own render bounds, which may miss the shadow content that is
// inside the frame.
//
// Fix: temporarily hide every non-overlay sibling, export the FULL parent frame
// (which correctly composites all effects within the frame boundary), then
// restore visibility.  The result is a single W×H PNG placed at (0,0) that
// faithfully captures every shadow / gradient overlay.
async function exportOverlayComposite(frameNode, scale, W, H) {
  var children   = frameNode.children;
  var hidden     = []; // child indices we hid
  var savedFills = null;

  // Hide every non-overlay child
  for (var i = 0; i < children.length; i++) {
    var ch = children[i];
    if (getLayerRole(ch.name) !== 'overlay' && ch.visible) {
      ch.visible = false;
      hidden.push(i);
    }
  }

  // Clear the frame's background fill so the exported PNG is transparent
  // everywhere except the shadow/overlay content — otherwise the frame bg
  // would opaquely cover all layers underneath the composite div.
  try {
    var currentFills = frameNode.fills;
    if (currentFills && currentFills.length) {
      savedFills = currentFills;
      frameNode.fills = [];
    }
  } catch (_fe) { /* fills not settable on this node type — ignore */ }

  var bytes;
  try {
    bytes = await frameNode.exportAsync({
      format:     'PNG',
      constraint: { type: 'SCALE', value: scale },
    });
  } finally {
    // Always restore visibility and fills
    for (var hi = 0; hi < hidden.length; hi++) {
      children[hidden[hi]].visible = true;
    }
    try {
      if (savedFills !== null) frameNode.fills = savedFills;
    } catch (_fe2) { /* ignore */ }
  }

  return {
    x:    0,
    y:    0,
    w:    W,
    h:    H,
    png:  toBase64(bytes),
    hash: simpleHash(bytes),
  };
}

// ── Full banner export for one size ──────────────────────────────────────────
//
// PHASE 1 – Collect
//   For every scene frame, export each direct child as a PNG.
//   If a direct child is a "static-ui" GROUP (like "CTA + Logo"), expand its
//   children so logo and CTA become independent layers.
//
// PHASE 2 – Deduplicate
//   Compare PNG hashes across scenes per layer name.
//   Identical hashes → static layer (always visible, exported once).
//   Different hashes → scene layer (cross-fade, exported per scene).
//   static-ui layers are always forced to static regardless of hashes.
//
async function exportSize(sizeKey, frames, settings) {
  var parts = sizeKey.split('x');
  var W     = Number(parts[0]);
  var H     = Number(parts[1]);
  var scale = (settings.scale !== undefined && settings.scale !== null) ? settings.scale : 1;

  var firstNode = await figma.getNodeByIdAsync(frames[0].id);
  if (!firstNode) throw new Error('First frame not found: ' + frames[0].id);
  if (!('children' in firstNode)) throw new Error('Frame has no children');

  var bgColor = getFrameBgColor(firstNode);
  var isVideo = hasVideoLayer(firstNode);

  var videoFillInfo       = findVideoFillNode(firstNode);
  var videoLayerResult    = null;
  var videoLayerInsertIdx = 0;
  var videoSceneIndices   = []; // frame indices (scenes) where the video layer is present

  figma.ui.postMessage({ type: 'progress', message: '  Scanning layers for ' + sizeKey + '…' });

  // ── Overlay composite: check if frame 0 has any overlay-role children ────
  // If it does, export them as a single composited frame PNG rather than as
  // individual node exports (individual exports clip the shadow at node bounds
  // and miss effects that extend into the frame from nodes positioned outside).
  var overlayCompositeData = null;
  var hasOverlayLayers = false;
  if ('children' in firstNode) {
    for (var oci = 0; oci < firstNode.children.length; oci++) {
      if (getLayerRole(firstNode.children[oci].name) === 'overlay') {
        hasOverlayLayers = true;
        break;
      }
    }
  }
  // Only use composite export on video banners.
  // Non-video banners (728x90, 300x50, 320x50…) must use per-layer exports
  // so their scene layers are exported individually and can cross-fade.
  if (hasOverlayLayers && isVideo) {
    figma.ui.postMessage({ type: 'progress', message: '  Compositing overlay/shadow layers for ' + sizeKey + '…' });
    try {
      overlayCompositeData = await exportOverlayComposite(firstNode, scale, W, H);
    } catch (oce) {
      figma.ui.postMessage({ type: 'warning', message: '  Overlay composite failed for ' + sizeKey + ': ' + oce.message });
    }
  }

  // ── Phase 1: export every child from every frame ──────────────────────────
  // layerDataByKey: key → [ { scene, x, y, w, h, png, hash } ]
  // layerOrder: [ { key, name, role, subRole, zIndex } ]  (z-order from frame 1)
  var layerDataByKey = {};
  var layerMetaMap   = {};
  var layerOrder     = [];
  var zCounter       = 0;

  for (var i = 0; i < frames.length; i++) {
    if (stopRequested) throw { stopped: true };
    var fn = await figma.getNodeByIdAsync(frames[i].id);
    if (!fn || !('children' in fn)) continue;

    for (var j = 0; j < fn.children.length; j++) {
      var child = fn.children[j];
      if (!child.visible) {
        // Warn when a layer is hidden in the first frame — it won't be exported at all
        if (i === 0) {
          figma.ui.postMessage({ type: 'warning', message: '  ⚠ Layer "' + child.name + '" is hidden in frame 1 of ' + sizeKey + ' — it will be missing from the export.' });
        }
        continue;
      }

      var role = getLayerRole(child.name);

      // ── Video container: skip regular export, extract video+poster instead ───
      // Match by VIDEO fill content (not name) — scene groups rename per frame:
      // "Master (1)", "Master (2)"… so name-matching only hits frame 0.
      if (videoFillInfo && nodeHasVideoFill(child)) {
        if (i === 0) {
          figma.ui.postMessage({ type: 'progress', message: '  Extracting video layer "' + child.name + '"…' });
          videoLayerInsertIdx = layerOrder.length; // z-position = layers added before this

          // Poster: export the video container as PNG (Figma renders the video thumbnail)
          var posterPng = null;
          try {
            var posterBytes = await child.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 1 } });
            posterPng = toBase64(posterBytes);
          } catch (pe) {
            figma.ui.postMessage({ type: 'warning', message: '  Poster export failed: ' + pe.message });
          }

          // figma.getVideoByHash() is not available in the public plugin API.
          // The user supplies the MP4 via the file picker in the plugin UI instead.
          var videoBase64 = null;

          videoLayerResult = {
            x:             videoFillInfo.x,
            y:             videoFillInfo.y,
            w:             videoFillInfo.w,
            h:             videoFillInfo.h,
            posterPng:     posterPng,
            videoBase64:   videoBase64,
            videoFilename: 'video_' + sizeKey + '.mp4',
          };
        }
        videoSceneIndices.push(i); // record every scene that contains this layer
        continue; // skip regular layer processing for the video container on all frames
      }

      // ── Expand ONLY combined "CTA + Logo" GROUPs ────────────────────────────
      // e.g. "CTA + Logo" group → export "BA_Logo" and "CTA" as separate layers
      // Individual CTA or Logo layers are exported as-is (no expansion).
      var items = [];
      var isCombinedGroup = /^cta\s*\+\s*logo/i.test(child.name);
      if (isCombinedGroup && child.children && child.children.length > 0) {
        for (var cj = 0; cj < child.children.length; cj++) {
          var sub = child.children[cj];
          if (sub.visible) {
            items.push({ node: sub, key: 'grp__' + sub.name, isSubLayer: true });
          }
        }
      }
      // If not a group (or group was empty), export the child itself
      if (items.length === 0) {
        items.push({ node: child, key: child.name, isSubLayer: false });
      }

      for (var ti = 0; ti < items.length; ti++) {
        var item     = items[ti];
        var node     = item.node;
        var nodeRole = item.isSubLayer ? getLayerRole(node.name) : role;

        // Overlay layers are handled via composite frame export — skip them
        // here so they don't appear as broken individual layers in the output.
        if (nodeRole === 'overlay' && overlayCompositeData) continue;

        // Scene layers are named differently per frame ("Master (1)", "Master (2)"…).
        // Group them by rounded position so all frames contribute to the same key
        // and the hash comparison in Phase 2 can detect changes → cross-fade.
        // Overlay layers use the same position-keying (fallback when no composite).
        var key = (!item.isSubLayer && (nodeRole === 'scene' || nodeRole === 'overlay'))
          ? nodeRole + '__' + Math.round(node.x / 5) * 5 + '_' + Math.round(node.y / 5) * 5
          : item.key;

        figma.ui.postMessage({
          type: 'progress',
          message: '  Frame ' + (i + 1) + '/' + frames.length + ': exporting "' + node.name + '"…',
        });

        var data;
        try {
          data = await exportChildLayer(node, scale, H);
        } catch (e) {
          if (e && e.stopped) throw e;
          var frameLabel = 'frame ' + (i + 1) + '/' + frames.length;
          var critical   = (i === 0) ? ' ⚠ (frame 1 — layer will be missing entirely)' : '';
          figma.ui.postMessage({ type: 'warning', message: '  Skipped "' + node.name + '" at ' + frameLabel + ': ' + e.message + critical });
          continue;
        }
        if (stopRequested) throw { stopped: true };
        data.scene = i;

        if (!layerDataByKey[key]) {
          layerDataByKey[key] = [];
          // Record meta only on the first frame (establishes z-order)
          if (i === 0) {
            zCounter++;
            layerMetaMap[key] = {
              key:     key,
              name:    node.name,
              role:    nodeRole,
              subRole: (nodeRole === 'static-ui') ? getStaticUiSubRole(node.name) : null,
              zIndex:  zCounter,
            };
            layerOrder.push(key);
          }
        }

        layerDataByKey[key].push(data);
      }
    }
  }

  // ── Phase 2: build layers array ───────────────────────────────────────────
  var layers = [];

  // When a video layer was found, bump z-indices of all layers above the insertion point.
  // If an overlay composite will also be inserted (just above the video), bump by 2 to
  // leave z-index videoLayerInsertIdx+2 free for the composite — otherwise bump by 1.
  if (videoLayerResult) {
    var videoBump = overlayCompositeData ? 2 : 1;
    for (var ppi = 0; ppi < layerOrder.length; ppi++) {
      var ppMeta = layerMetaMap[layerOrder[ppi]];
      if (ppMeta.zIndex > videoLayerInsertIdx) {
        ppMeta.zIndex += videoBump;
      }
    }
  }

  for (var oi = 0; oi < layerOrder.length; oi++) {
    var key      = layerOrder[oi];
    var meta     = layerMetaMap[key];
    var scenes   = layerDataByKey[key];

    // static-ui and overlay layers are always static — never cross-fade.
    // overlay: shadow/gradient layers that must remain visible over the video
    // at all times, regardless of which scene is active.
    var forceStatic = (meta.role === 'static-ui' || meta.role === 'overlay');

    // Detect change: compare full base64 strings (exact pixel identity).
    // Sampled hashes can give false "different" results when Figma's PNG renderer
    // produces subtly different bytes for the same layer across frames (effects,
    // gradients). String equality on the base64 is definitive.
    var firstPng = scenes[0].png;
    var isStatic = forceStatic || scenes.length === 1 ||
                   scenes.every(function(d) { return d.png === firstPng; });

    if (isStatic) {
      layers.push({
        name:     meta.name,
        role:     meta.role,
        subRole:  meta.subRole,
        isStatic: true,
        x:        scenes[0].x,
        y:        scenes[0].y,
        w:        scenes[0].w,
        h:        scenes[0].h,
        png:      scenes[0].png,
        zIndex:   meta.zIndex,
      });
    } else {
      layers.push({
        name:     meta.name,
        role:     meta.role,
        isStatic: false,
        scenes:   scenes,   // [ { scene, x, y, w, h, png, hash } ]
        zIndex:   meta.zIndex,
      });
    }
  }

  // Inject the overlay composite just above the video layer.
  // Video is at videoLayerInsertIdx+1; composite at videoLayerInsertIdx+2.
  // Content layers above the video (scene copy, logos, CTAs) were bumped by +2
  // in the loop above, so they sit at videoLayerInsertIdx+3 and above.
  if (overlayCompositeData) {
    layers.push({
      name:     '__overlay_composite',
      role:     'overlay',
      subRole:  null,
      isStatic: true,
      x:        0,
      y:        0,
      w:        W,
      h:        H,
      png:      overlayCompositeData.png,
      zIndex:   videoLayerInsertIdx + 2,
    });
  }

  return {
    sizeKey:        sizeKey,
    W:              W,
    H:              H,
    bgColor:        bgColor,
    isVideo:        isVideo,
    mode:           'layered',
    layers:         layers,
    sceneCount:     frames.length,
    videoLayer:        videoLayerResult,
    videoInsertIdx:    videoLayerResult ? videoLayerInsertIdx : null,
    videoSceneIndices: videoLayerResult ? videoSceneIndices  : [],
  };
}

// ── Message handler ───────────────────────────────────────────────────────────
figma.ui.onmessage = async function(msg) {

  if (msg.type === 'scan') {
    var scanResult = scanSections();

    // ── Sections: completely flat parallel string/number arrays ───────────────
    // NEVER send nested objects-inside-arrays or arrays-inside-objects to
    // postMessage — Figma's deepUnwrap serialiser aborts on recursive nesting.
    // The UI reconstructs section objects from these parallel arrays.
    var sectionIds        = [];
    var sectionNames      = [];
    var sectionFunnels    = [];
    var sectionCopyCodes  = [];
    var sectionSizeCounts = [];
    if (scanResult.hasSections) {
      for (var si2 = 0; si2 < scanResult.sections.length; si2++) {
        var sec = scanResult.sections[si2];
        sectionIds.push(String(sec.id));
        sectionNames.push(String(sec.name));
        sectionFunnels.push(String(sec.funnel));
        sectionCopyCodes.push(String(sec.copyCode));
        sectionSizeCounts.push(Object.keys(sec.banners).length);
      }
    }

    // ── Banners: two flat parallel arrays (keys + counts), no nested objects ──
    var bannerKeys   = [];
    var bannerCounts = [];
    var flatBanners  = scanResult.flatBanners;
    var flatKeys     = Object.keys(flatBanners);
    for (var fki = 0; fki < flatKeys.length; fki++) {
      var fk = String(flatKeys[fki]);
      bannerKeys.push(fk);
      bannerCounts.push(flatBanners[fk].length);
    }

    figma.ui.postMessage({
      type:             'scan-result',
      hasSections:      !!scanResult.hasSections,
      sectionIds:       sectionIds,
      sectionNames:     sectionNames,
      sectionFunnels:   sectionFunnels,
      sectionCopyCodes: sectionCopyCodes,
      sectionSizeCounts: sectionSizeCounts,
      bannerKeys:       bannerKeys,
      bannerCounts:     bannerCounts,
      executionType:    readExecutionType() || '',
      campaign:         readControlPanelField('campaign') || '',
    });
    return;
  }

  if (msg.type === 'export') {
    var selectedSizes    = msg.selectedSizes;    // ['300x250', '728x90', …]
    var selectedSections = msg.selectedSections; // null in flat mode, or [{id,name,funnel,copyCode}]
    var settings         = msg.settings;
    var results          = [];
    var errors           = [];
    stopRequested        = false;

    if (selectedSections && selectedSections.length > 0) {
      // ── Section mode: one export pass per section ──────────────────────────
      var freshScan = scanSections();

      // Count total jobs upfront for accurate progress
      var totalJobs = 0;
      for (var ci = 0; ci < selectedSections.length; ci++) {
        var cSec = null;
        for (var cni = 0; cni < freshScan.sections.length; cni++) {
          if (freshScan.sections[cni].id === selectedSections[ci].id) { cSec = freshScan.sections[cni]; break; }
        }
        if (!cSec) continue;
        for (var cki = 0; cki < selectedSizes.length; cki++) {
          if (cSec.banners[selectedSizes[cki]]) totalJobs++;
        }
      }
      figma.ui.postMessage({ type: 'export-total', total: totalJobs });

      for (var secIdx = 0; secIdx < selectedSections.length; secIdx++) {
        var secInfo = selectedSections[secIdx];

        // Match section by id
        var secNode = null;
        for (var sni = 0; sni < freshScan.sections.length; sni++) {
          if (freshScan.sections[sni].id === secInfo.id) {
            secNode = freshScan.sections[sni];
            break;
          }
        }
        if (!secNode) {
          errors.push('Section "' + secInfo.name + '": not found on page');
          continue;
        }

        figma.ui.postMessage({ type: 'progress', message: '── Section: ' + secNode.name + ' ──' });

        for (var ski = 0; ski < selectedSizes.length; ski++) {
          var sizeKeyS = selectedSizes[ski];
          if (!secNode.banners[sizeKeyS]) continue; // size absent in this section — skip silently

          figma.ui.postMessage({ type: 'progress', message: '  Processing ' + sizeKeyS + '…' });
          var _stopped = false;
          try {
            var resS       = await exportSize(sizeKeyS, secNode.banners[sizeKeyS], settings);
            resS.funnel    = secNode.funnel;
            resS.copyCode  = secNode.copyCode;
            resS.sectionName = secNode.name;
            results.push(resS);
          } catch (eS) {
            if (eS && eS.stopped) { _stopped = true; }
            else {
              var errLabel = secNode.name + ' / ' + sizeKeyS;
              errors.push(errLabel + ': ' + eS.message);
              figma.ui.postMessage({ type: 'error', message: '✕ ' + errLabel + ': ' + eS.message });
            }
          }
          figma.ui.postMessage({ type: 'export-tick' });
          if (_stopped || stopRequested) return;
        }
        if (stopRequested) return;
      }

    } else {
      // ── Flat mode: original behaviour ─────────────────────────────────────
      var allBanners = scanPage();

      figma.ui.postMessage({ type: 'export-total', total: selectedSizes.length });

      for (var si = 0; si < selectedSizes.length; si++) {
        var sizeKey = selectedSizes[si];
        if (!allBanners[sizeKey]) {
          errors.push(sizeKey + ': no frames found on page');
          figma.ui.postMessage({ type: 'export-tick' });
          continue;
        }
        figma.ui.postMessage({ type: 'progress', message: 'Processing ' + sizeKey + '…' });
        var _flatStopped = false;
        try {
          var result = await exportSize(sizeKey, allBanners[sizeKey], settings);
          results.push(result);
        } catch (e) {
          if (e && e.stopped) { _flatStopped = true; }
          else {
            errors.push(sizeKey + ': ' + e.message);
            figma.ui.postMessage({ type: 'error', message: '✕ ' + sizeKey + ': ' + e.message });
          }
        }
        figma.ui.postMessage({ type: 'export-tick' });
        if (_flatStopped || stopRequested) return;
      }
    }

    figma.ui.postMessage({ type: 'export-complete', results: results, settings: settings, errors: errors });
    return;
  }

  if (msg.type === 'stop') {
    stopRequested = true;
    return;
  }

  if (msg.type === 'close') {
    figma.closePlugin();
  }
};
