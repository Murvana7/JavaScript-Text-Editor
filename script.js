let optionsButtons = document.querySelectorAll('.option-button');
let advancedOptions = document.querySelectorAll('.adv-option-button');
let fontName = document.getElementById('fontName');
let fontSizeRef = document.getElementById('fontSize');
let writingArea = document.getElementById('text-input');

let alignButtons = document.querySelectorAll('.align');
let spacingButtons = document.querySelectorAll('.spacing');
let formatButtons = document.querySelectorAll('.format');
let scriptButtons = document.querySelectorAll('.script');

let linkButton = document.getElementById("createLink");

let fontList = [
    "Arial",
    "Verdana",
    "Times New Roman",
    "Garamond",
    "Georgia",
    "Courier New",
    "Cursive",
];

const initializer = () => {
    highlighter(alignButtons, true);
    highlighter(spacingButtons, true);
    highlighter(formatButtons, false);
    highlighter(scriptButtons, true);

    fontList.forEach((value) => {
        let option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        fontName.appendChild(option);
    });

    for (let i = 1; i <= 7; i++) {
        let option = document.createElement("option");
        option.value = i;
        option.textContent = i;
        fontSizeRef.appendChild(option);
    }

    fontSizeRef.value = 3;
};

const modifyText = (command, defaultUi, value) => {
    document.execCommand(command, defaultUi, value);
};

optionsButtons.forEach((button) => {
    button.addEventListener("click", () => {
        modifyText(button.id, false, null);
    });
});

advancedOptions.forEach((button) => {
    button.addEventListener("change", () => {
        modifyText(button.id, false, button.value);
    });
});

linkButton.addEventListener("click", () => {
    let userLink = prompt("Enter a URL:");
    if (!userLink) return;

    if (!/^https?:\/\//i.test(userLink)) {
        userLink = "http://" + userLink;
    }
    modifyText("createLink", false, userLink);
});

const highlighter = (buttons, needsRemoval) => {
    buttons.forEach((button) => {
        button.addEventListener("click", () => {
            if (needsRemoval) {
                let active = button.classList.contains("active");
                highlighterRemover(buttons);
                if (!active) button.classList.add("active");
            } else {
                button.classList.toggle("active");
            }
        });
    });
};

const highlighterRemover = (buttons) => {
    buttons.forEach((button) => {
        button.classList.remove("active");
    });
};

window.onload = initializer;
writingArea.addEventListener("keyup", updateActiveStates);
writingArea.addEventListener("mouseup", updateActiveStates);

function updateActiveStates(){
  const cmds = ["bold","superscript","subscript","justifyLeft","justifyCenter","justifyRight","justifyFull"];
  cmds.forEach(cmd=>{
    const btn = document.getElementById(cmd);
    if(!btn) return;
    try{
      document.queryCommandState(cmd) ? btn.classList.add("active") : btn.classList.remove("active");
    }catch(e){}
  });
}
const themeToggle = document.getElementById("themeToggle");

function applyTheme(theme) {
  document.body.classList.toggle("dark", theme === "dark");
  localStorage.setItem("theme", theme);

  // swap icon
  const icon = themeToggle?.querySelector("i");
  if (icon) {
    icon.classList.remove("fa-moon", "fa-sun");
    icon.classList.add(theme === "dark" ? "fa-sun" : "fa-moon");
  }
}

function initTheme() {
  const saved = localStorage.getItem("theme");
  if (saved) return applyTheme(saved);

  // first visit: use system preference
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(prefersDark ? "dark" : "light");
}

themeToggle?.addEventListener("click", () => {
  const isDark = document.body.classList.contains("dark");
  applyTheme(isDark ? "light" : "dark");
});

// call this inside initializer or on load
initTheme();

