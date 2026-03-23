const form = document.getElementById("todo-form");
const input = document.getElementById("todo-input");
const list = document.getElementById("todo-list");
const footer = document.getElementById("footer");
const countEl = document.getElementById("count");
const clearBtn = document.getElementById("clear-completed");

let todos = JSON.parse(localStorage.getItem("todos")) || [];

function save() {
    localStorage.setItem("todos", JSON.stringify(todos));
}

function render() {
    list.innerHTML = "";

    todos.forEach((todo, i) => {
        const li = document.createElement("li");
        if (todo.done) li.classList.add("completed");

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = todo.done;
        checkbox.addEventListener("change", () => {
            todos[i].done = checkbox.checked;
            save();
            render();
        });

        const span = document.createElement("span");
        span.textContent = todo.text;
        span.addEventListener("dblclick", () => startEdit(li, i));

        const editBtn = document.createElement("button");
        editBtn.className = "edit-btn";
        editBtn.textContent = "\u270E";
        editBtn.addEventListener("click", () => startEdit(li, i));

        const del = document.createElement("button");
        del.className = "delete-btn";
        del.textContent = "\u00d7";
        del.addEventListener("click", () => {
            todos.splice(i, 1);
            save();
            render();
        });

        li.append(checkbox, span, editBtn, del);
        list.appendChild(li);
    });

    const remaining = todos.filter((t) => !t.done).length;
    countEl.textContent = `${remaining} g\u00f6rev kald\u0131`;
    footer.classList.toggle("hidden", todos.length === 0);
}

form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    todos.push({ text, done: false });
    input.value = "";
    save();
    render();
});

function startEdit(li, i) {
    li.classList.add("editing");
    const editInput = document.createElement("input");
    editInput.type = "text";
    editInput.className = "edit-input";
    editInput.value = todos[i].text;

    function finishEdit() {
        const newText = editInput.value.trim();
        if (newText) todos[i].text = newText;
        save();
        render();
    }

    editInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") finishEdit();
        if (e.key === "Escape") render();
    });
    editInput.addEventListener("blur", finishEdit);

    li.innerHTML = "";
    li.appendChild(editInput);
    editInput.focus();
    editInput.select();
}

clearBtn.addEventListener("click", () => {
    todos = todos.filter((t) => !t.done);
    save();
    render();
});

render();
