    const $ = s => document.querySelector(s);

    const optionsButtons = document.querySelectorAll('.option-button');
    const advancedOptions = document.querySelectorAll('.adv-option-button');

    const fontName = $("#fontName");
    const fontSizeRef = $("#fontSize");
    const writingArea = $("#text-input");

    const alignButtons = document.querySelectorAll('.align');
    const spacingButtons = document.querySelectorAll('.spacing');
    const formatButtons = document.querySelectorAll('.format');
    const scriptButtons = document.querySelectorAll('.script');

    const linkButton = $("#createLink");
    const themeToggle = $("#themeToggle");
    const saveState = $("#saveState");
    const toast = $("#toast");

    const findBtn = $("#findBtn");
    const counterText = $("#counterText");

    const modal = $("#modal");
    const closeModal = $("#closeModal");
    const findInput = $("#findInput");
    const replaceInput = $("#replaceInput");
    const matchCase = $("#matchCase");
    const findNextBtn = $("#findNext");
    const replaceOneBtn = $("#replaceOne");
    const replaceAllBtn = $("#replaceAll");

    const STORAGE_KEY = "ultra_editor_content_v3";
    const THEME_KEY   = "ultra_editor_theme_v1";

    const fontList = [
      "Poppins","Arial","Verdana","Times New Roman","Garamond","Georgia","Courier New","Cursive"
    ];

    function showToast(msg){
      toast.textContent = msg;
      toast.classList.add("show");
      clearTimeout(showToast.t);
      showToast.t = setTimeout(()=>toast.classList.remove("show"), 1300);
    }

    // Save/restore selection for link/find actions
    let savedRange = null;

    function saveSelection(){
      const sel = window.getSelection();
      if(sel && sel.rangeCount > 0){
        const r = sel.getRangeAt(0);
        if(writingArea.contains(r.commonAncestorContainer)) savedRange = r;
      }
    }
    function restoreSelection(){
      const sel = window.getSelection();
      if(!sel || !savedRange) return;
      sel.removeAllRanges();
      sel.addRange(savedRange);
    }

    // Track selection changes (only if inside editor)
    document.addEventListener("selectionchange", () => {
      const sel = window.getSelection();
      if(!sel || sel.rangeCount === 0) return;
      const r = sel.getRangeAt(0);
      if(writingArea.contains(r.commonAncestorContainer)) savedRange = r;
    });

    // Prevent toolbar from stealing selection/caret
    document.querySelectorAll(".options button, .options select, .options input, .right-tools button").forEach(el => {
      el.addEventListener("mousedown", (e) => {
        if(modal.contains(e.target)) return; // don't interfere with modal inputs/buttons
        e.preventDefault(); // keep caret in editor
      });
    });

    // execCommand wrapper (formatBlock expects tags)
    function modifyText(command, defaultUi, value){
      try{
        if(command === "formatBlock" && value){
          document.execCommand(command, defaultUi, `<${value}>`);
          return;
        }
        document.execCommand(command, defaultUi, value);
      }catch(e){
        showToast("Command not supported in this browser.");
      }
    }

    // Active state sync
    function updateActiveStates(){
      const cmds = [
        "bold","italic","underline",
        "superscript","subscript",
        "justifyLeft","justifyCenter","justifyRight","justifyFull",
        "insertOrderedList","insertUnorderedList"
      ];
      cmds.forEach(cmd=>{
        const btn = document.getElementById(cmd);
        if(!btn) return;
        try{
          document.queryCommandState(cmd) ? btn.classList.add("active") : btn.classList.remove("active");
        }catch(e){}
      });
    }

    function highlighter(buttons, needsRemoval){
      buttons.forEach(button=>{
        button.addEventListener("click", ()=>{
          restoreSelection();
          writingArea.focus({preventScroll:true});

          if(needsRemoval){
            const active = button.classList.contains("active");
            buttons.forEach(b=>b.classList.remove("active"));
            if(!active) button.classList.add("active");
          }else{
            button.classList.toggle("active");
          }

          saveSelection();
          updateActiveStates();
          scheduleSave();
          updateCounter();
        });
      });
    }

    // Theme
    function applyTheme(theme){
      document.body.classList.toggle("dark", theme === "dark");
      localStorage.setItem(THEME_KEY, theme);

      const icon = themeToggle?.querySelector("i");
      if(icon){
        icon.classList.remove("fa-moon","fa-sun");
        icon.classList.add(theme === "dark" ? "fa-sun" : "fa-moon");
      }
    }
    function initTheme(){
      const saved = localStorage.getItem(THEME_KEY);
      if(saved) return applyTheme(saved);
      const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      applyTheme(prefersDark ? "dark" : "light");
    }

    // Autosave
    let saveTimer = null;
    let dirty = false;

    function setSavedState(state){
      if(state === "saving"){
        saveState.innerHTML = '<i class="fa-solid fa-floppy-disk"></i><span>Saving…</span>';
      }else{
        saveState.innerHTML = '<i class="fa-solid fa-floppy-disk"></i><span>Saved</span>';
      }
    }

    function saveContent(){
      if(!dirty) return;
      setSavedState("saving");
      localStorage.setItem(STORAGE_KEY, writingArea.innerHTML);
      dirty = false;
      setSavedState("saved");
    }

    function scheduleSave(){
      dirty = true;
      setSavedState("saving");
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveContent, 350);
    }

    function restoreContent(){
      writingArea.innerHTML = localStorage.getItem(STORAGE_KEY) || "";
    }

    // Counter
    function updateCounter(){
      if(!counterText) return;
      const raw = writingArea.innerText || "";
      const trimmed = raw.replace(/\s+/g," ").trim();
      const words = trimmed ? trimmed.split(" ").length : 0;
      const chars = raw.length;
      counterText.textContent = `${words} words • ${chars} chars`;
    }

    // Download helper
    function download(filename, text, type="text/plain"){
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([text], {type}));
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
    }

    // Modal
    function openModal(){
      modal.style.display = "grid";
      modal.setAttribute("aria-hidden","false");
      findInput.focus();
    }
    function closeModalFn(){
      modal.style.display = "none";
      modal.setAttribute("aria-hidden","true");
      writingArea.focus();
    }

    // Find next (selection-based search in plain text)
    function escapeRegExp(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

    function selectByTextIndex(start, end){
      const walker = document.createTreeWalker(writingArea, NodeFilter.SHOW_TEXT, null);
      let node, idx = 0;
      let startNode=null, endNode=null, startOff=0, endOff=0;

      while((node = walker.nextNode())){
        const len = node.nodeValue.length;
        if(!startNode && idx + len >= start){
          startNode = node;
          startOff = start - idx;
        }
        if(idx + len >= end){
          endNode = node;
          endOff = end - idx;
          break;
        }
        idx += len;
      }

      if(startNode && endNode){
        const range = document.createRange();
        range.setStart(startNode, startOff);
        range.setEnd(endNode, endOff);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        writingArea.focus();
        saveSelection();
      }
    }

    function findNext(){
      const q = findInput.value || "";
      if(!q) return showToast("Type something to find.");

      const flags = matchCase.checked ? "g" : "gi";
      const text = writingArea.innerText || "";
      const re = new RegExp(escapeRegExp(q), flags);

      const sel = window.getSelection();
      let startIndex = 0;
      if(sel && sel.rangeCount){
        const range = sel.getRangeAt(0);
        const pre = range.cloneRange();
        pre.selectNodeContents(writingArea);
        pre.setEnd(range.endContainer, range.endOffset);
        startIndex = pre.toString().length;
      }

      re.lastIndex = startIndex;
      let m = re.exec(text);
      if(!m){
        re.lastIndex = 0;
        m = re.exec(text);
        if(!m) return showToast("Not found.");
      }

      selectByTextIndex(m.index, m.index + m[0].length);
      showToast("Found");
    }

    function replaceAllPreserveFormatting(findStr, replaceStr, caseSensitive){
      const walker = document.createTreeWalker(writingArea, NodeFilter.SHOW_TEXT, null);
      const nodes = [];
      let n;
      while((n = walker.nextNode())) nodes.push(n);

      if(!findStr) return 0;

      const flags = caseSensitive ? "g" : "gi";
      const re = new RegExp(escapeRegExp(findStr), flags);
      let count = 0;

      nodes.forEach(node => {
        const before = node.nodeValue;
        const after = before.replace(re, () => {
          count++;
          return replaceStr;
        });
        if(after !== before) node.nodeValue = after;
      });

      return count;
    }

    function replaceOne(){
      const q = findInput.value || "";
      if(!q) return showToast("Type something to find.");

      const sel = window.getSelection();
      if(sel && sel.toString()){
        const replacement = replaceInput.value || "";
        document.execCommand("insertText", false, replacement);
        scheduleSave();
        updateCounter();
        showToast("Replaced");
      }else{
        findNext();
      }
    }

    function replaceAll(){
      const q = findInput.value || "";
      if(!q) return showToast("Type something to find.");

      const replacement = replaceInput.value || "";
      const count = replaceAllPreserveFormatting(q, replacement, matchCase.checked);

      if(!count) return showToast("Not found.");
      scheduleSave();
      updateCounter();
      showToast(`Replaced ${count}`);
    }

    function initializer(){
      highlighter(alignButtons, true);
      highlighter(spacingButtons, true);
      highlighter(formatButtons, false);
      highlighter(scriptButtons, true);

      fontName.innerHTML = "";
      fontList.forEach(v=>{
        const o = document.createElement("option");
        o.value = v;
        o.textContent = v;
        fontName.appendChild(o);
      });

      fontSizeRef.innerHTML = "";
      for(let i=1;i<=7;i++){
        const o = document.createElement("option");
        o.value = i;
        o.textContent = i;
        fontSizeRef.appendChild(o);
      }
      fontSizeRef.value = 3;

      initTheme();
      restoreContent();
      updateActiveStates();
      setSavedState("saved");
      updateCounter();
    }

    // Toolbar wiring (fixed)
    optionsButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        restoreSelection();
        writingArea.focus({ preventScroll: true });

        modifyText(btn.id, false, null);

        saveSelection();
        updateActiveStates();
        scheduleSave();
        updateCounter();
      });
    });

    advancedOptions.forEach(el => {
      el.addEventListener("change", () => {
        restoreSelection();
        writingArea.focus({ preventScroll: true });

        modifyText(el.id, false, el.value);

        saveSelection();
        scheduleSave();
        updateCounter();
      });
    });

    // Editor events
    writingArea.addEventListener("keyup", ()=>{ saveSelection(); updateActiveStates(); scheduleSave(); updateCounter(); });
    writingArea.addEventListener("mouseup", ()=>{ saveSelection(); updateActiveStates(); updateCounter(); });
    writingArea.addEventListener("input", ()=>{ saveSelection(); scheduleSave(); updateCounter(); });

    // Link
    linkButton.addEventListener("click", ()=>{
      saveSelection();
      let userLink = prompt("Enter a URL:");
      if(!userLink) return;
      if(!/^https?:\/\//i.test(userLink)) userLink = "https://" + userLink;
      restoreSelection();
      modifyText("createLink", false, userLink);
      writingArea.focus();
      scheduleSave();
    });

    // Theme
    themeToggle.addEventListener("click", ()=>{
      const isDark = document.body.classList.contains("dark");
      applyTheme(isDark ? "light" : "dark");
      showToast(isDark ? "Light mode" : "Dark mode");
    });

    // Copy
    $("#copyAll").addEventListener("click", async ()=>{
      const text = writingArea.innerText || "";
      if(!text.trim()) return showToast("Nothing to copy.");
      try{ await navigator.clipboard.writeText(text); showToast("Copied ✅"); }
      catch(e){ showToast("Copy blocked by browser."); }
    });

    // Downloads
    $("#downloadTxt").addEventListener("click", ()=>{
      download("document.txt", writingArea.innerText || "", "text/plain");
      showToast("Downloaded .txt");
    });

    $("#downloadHtml").addEventListener("click", ()=>{
      const html = writingArea.innerHTML || "";
      const full = `<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
      download("document.html", full, "text/html");
      showToast("Downloaded .html");
    });

    // Print
    $("#printPdf").addEventListener("click", ()=>{
      window.print();
    });

    // Clear
    $("#clearAll").addEventListener("click", ()=>{
      if(!confirm("Clear the editor?")) return;
      writingArea.innerHTML = "";
      scheduleSave();
      updateCounter();
      showToast("Cleared");
    });

    // Find/Replace modal
    findBtn.addEventListener("click", openModal);
    closeModal.addEventListener("click", closeModalFn);
    modal.addEventListener("click", (e)=>{ if(e.target === modal) closeModalFn(); });

    findNextBtn.addEventListener("click", findNext);
    replaceOneBtn.addEventListener("click", replaceOne);
    replaceAllBtn.addEventListener("click", replaceAll);

    // Keyboard shortcuts
    document.addEventListener("keydown", (e)=>{
      const k = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;

      if(ctrl && k === "b"){ e.preventDefault(); restoreSelection(); modifyText("bold", false, null); saveSelection(); updateActiveStates(); scheduleSave(); }
      if(ctrl && k === "i"){ e.preventDefault(); restoreSelection(); modifyText("italic", false, null); saveSelection(); updateActiveStates(); scheduleSave(); }
      if(ctrl && k === "u"){ e.preventDefault(); restoreSelection(); modifyText("underline", false, null); saveSelection(); updateActiveStates(); scheduleSave(); }
      if(ctrl && k === "k"){ e.preventDefault(); linkButton.click(); }
      if(ctrl && k === "f"){ e.preventDefault(); openModal(); }
      if(k === "escape" && modal.style.display === "grid"){ closeModalFn(); }
    });

    window.addEventListener("beforeunload", ()=> localStorage.setItem(STORAGE_KEY, writingArea.innerHTML));

    window.onload = initializer;