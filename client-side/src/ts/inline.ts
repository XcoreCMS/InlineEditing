/// <reference path="../../dist/tinymce/tinymce.d.ts" />

import Editor = TinyMCE.Editor
import {BaseItem, EntityItem, SimpleItem} from './items'

class Inline {

    // url of server enpoint
    public gatewayUrl: string

    // html nodes (tinymce or entitySpecific)
    public editables: NodeListOf<Element>

    // list of actual changes - id is unique html id
    public changes: { [id: string]: BaseItem } = {}

    // content backups
    public backups: { [id: string]: string } = {}

    public btns: { [id: string]: HTMLButtonElement } = {}

    public editableConfigs: any = {
        'headings': {
            selector: 'h1.inline-editing-tinymce, h2.inline-editing-tinymce, h3.inline-editing-tinymce, h4.inline-editing-tinymce, h5.inline-editing-tinymce, h6.inline-editing-tinymce',
            toolbar: 'italic strikethrough | nonbreaking | undo redo',
        },
        'inlines': {
            selector: 'span.inline-editing-tinymce, strong.inline-editing-tinymce, a.inline-editing-tinymce',
            forced_root_block: '',
            toolbar: 'bold italic strikethrough | nonbreaking | link | undo redo'
        },
        'blocks': {
            selector: 'div.inline-editing-tinymce',
            toolbar: 'bold italic strikethrough | nonbreaking | fontsizeselect | styleselect bullist numlist link image | undo redo',
            style_formats: [
                {
                    title: 'Nadpisy',
                    items: [
                        {title: 'Nadpis 1', format: 'h1'},
                        {title: 'Nadpis 2', format: 'h2'},
                        {title: 'Nadpis 3', format: 'h3'},
                        {title: 'Nadpis 4', format: 'h4'},
                        {title: 'Nadpis 5', format: 'h5'},
                        {title: 'Nadpis 6', format: 'h6'}
                    ]
                },
                {title: 'Horní index', icon: 'superscript', format: 'superscript'},
                {title: 'Dolní index', icon: 'subscript', format: 'subscript'},
                {
                    title: 'Zarovnání', icon: 'alignleft', items: [
                        {title: 'Doleva', icon: 'alignleft', format: 'alignleft'},
                        {title: 'Na střed', icon: 'aligncenter', format: 'aligncenter'},
                        {title: 'Doprava', icon: 'alignright', format: 'alignright'},
                        {title: 'Do bloku', icon: 'alignjustify', format: 'alignjustify'}
                    ]
                }
            ]
        }
    }

    public constructor() {
        let source = document.getElementById('inline-editing-source')

        if (!source) {
            return
        }

        let cssLink = document.createElement('link')
        cssLink.href = source.getAttribute('data-source-css')
        cssLink.setAttribute('rel', 'stylesheet')
        cssLink.setAttribute('type', 'text/css')
        document.head.insertBefore(cssLink, document.head.firstChild)

        this.gatewayUrl = source.getAttribute('data-source-gateway-url')

        if (typeof tinymce === 'undefined') {
            let tinymceLink = document.createElement('script')
            tinymceLink.src = source.getAttribute('data-source-tinymce-js')
            tinymceLink.onload = () => this.initUI()
            document.head.insertBefore(tinymceLink, document.head.firstChild)
        } else {
            this.initUI()
        }
    }

    // init buttons
    public initUI() {
        let container = document.createElement('div')
        container.classList.add('inline-container')

        let btnEnable = this.btns['enable'] = document.createElement('button')
        btnEnable.innerHTML = '<i class="inline-icon-xcore"></i>'
        btnEnable.className = 'inline-editing-btn inline-enable'
        btnEnable.addEventListener('click', () => this.enable())
        container.appendChild(btnEnable)

        let btnDisable = this.btns['disable'] = document.createElement('button')
        btnDisable.innerHTML = '<i class="inline-icon-xcore"></i>'
        btnDisable.className = 'inline-editing-btn inline-disable inline-hidden'
        btnDisable.addEventListener('click', () => this.disable())
        container.appendChild(btnDisable)

        let btnStatus = this.btns['status'] = document.createElement('button')
        btnStatus.className = 'inline-editing-btn inline-status inline-hidden'
        container.appendChild(btnStatus)

        let btnSave = this.btns['save'] = document.createElement('button')
        btnSave.innerHTML = '<i class="inline-icon-save"></i>'
        btnSave.className = 'inline-editing-btn inline-save inline-hidden inactive'
        btnSave.addEventListener('click', () => this.saveAll())
        container.appendChild(btnSave)

        let btnRevert = this.btns['revert'] = document.createElement('button')
        btnRevert.innerHTML = '<i class="inline-icon-trash"></i>'
        btnRevert.className = 'inline-editing-btn inline-revert inline-hidden inactive'
        btnRevert.addEventListener('click', () => this.revertAll())
        container.appendChild(btnRevert)

        document.body.appendChild(container)

        this.preInitTinymce()
    }

    // preinit tinymce and entitySpecific elements
    public preInitTinymce() {

        this.editables = document.querySelectorAll('*[data-inline-type]')

        let counter = 0;
        this.editablesForeach((el) => {
            let type = el.getAttribute('data-inline-type')
            el.classList.add((type === 'simple' || type === 'entity') ? 'inline-editing-tinymce' : 'inline-editing-specific')
            if (!el.id) {
                el.id = 'xcore_' + counter++
            }
        })

        this.backup()
    }

    // update changes list - tinymce items
    public updateTinymceContent(editor: Editor) {

        let el = editor.bodyElement
        let key = el.id
        let content = editor.getContent();

        if (this.changes.hasOwnProperty(key)) {
            this.changes[key].content = content
        } else {
            if (el.dataset['inlineType'] === 'simple') {
                this.changes[key] = new SimpleItem(
                    el.dataset['inlineNamespace'],
                    el.dataset['inlineLocale'],
                    el.dataset['inlineName'],
                    content
                )
            } else if (el.dataset['inlineType'] === 'entity') {
                this.changes[key] = new EntityItem(
                    el.dataset['inlineEntity'],
                    el.dataset['inlineId'],
                    el.dataset['inlineProperty'],
                    content
                )
            } else {
                console.log('invalid type')
            }
        }

        this.btns['status'].classList.add('inline-hidden')
        this.btns['save'].classList.remove('inactive')
        this.btns['revert'].classList.remove('inactive')
    }

    // send all changes to server
    public saveAll() {
        let saveBtn = this.btns['save']
        if (saveBtn.classList.contains('inactive')) {
            return
        }

        let statusBtn = this.btns['status']
        statusBtn.classList.remove('inline-hidden')
        statusBtn.innerHTML = '<i class="inline-icon-progress"></i>'

        let xhr = new XMLHttpRequest()

        xhr.open('POST', this.gatewayUrl)
        xhr.setRequestHeader('Content-Type', 'application/json')
        xhr.onload = () => {
            this.clearErrors()

            if (xhr.status === 200) {
                statusBtn.innerHTML = '<i class="inline-icon-ok"></i>'
                this.changes = {}
                this.backup()
                this.btns['revert'].classList.add('inactive')
            } else {
                statusBtn.innerHTML = '<i class="inline-icon-error"></i>'
            }

            let statusData = []

            try {
                statusData = JSON.parse(xhr.responseText)
            } catch (e) {
                alert('Server error (json)');
            }

            for (let editableId in statusData) {
                let el = document.getElementById(editableId)

                if (el) {
                    switch (statusData[editableId].status) {
                        case 0:
                            // ok - remove from changes
                            delete this.changes[editableId]
                            el.classList.add('inline-content-success')
                            setTimeout(() => el.classList.remove('inline-content-success'), 500)
                            break;
                        case 1:
                            // warning
                            el.classList.add('inline-content-warning')
                            break;
                        default:
                            el.classList.add('inline-content-error')
                            let errMsg = document.createElement('span')
                            errMsg.classList.add('inline-error-msg')
                            errMsg.innerHTML = statusData[editableId].message
                            el.parentNode.insertBefore(errMsg, el.nextSibling);
                            break;
                    }
                } else if (statusData[editableId].message) {
                    alert(statusData[editableId].message);
                } else {
                    alert('Server error (unknown)')
                }
            }

            saveBtn.classList.add('inactive')
        }

        xhr.send(JSON.stringify(this.changes))
    }

    // clear error messages and red colors
    public clearErrors() {
        // clear error content styles
        this.editablesForeach((el) => el.classList.remove('inline-content-error', 'inline-content-warning'))

        // clear error messages
        let msgElems = document.querySelectorAll('.inline-error-msg')
        for (let i = 0; i < msgElems.length; i++) {
            msgElems[i].remove()
        }
    }

    // revert all content to start state
    public revertAll() {
        this.clearErrors()

        this.editablesForeach((el) => el.innerHTML = this.backups[el.id])
        this.btns['save'].classList.add('inactive')
        this.btns['status'].classList.add('inline-hidden')
        this.btns['revert'].classList.add('inactive')
        this.changes = {}
    }

    // enable all
    public enable() {
        this.btns['enable'].classList.add('inline-hidden')
        this.btns['disable'].classList.remove('inline-hidden')
        this.btns['save'].classList.remove('inline-hidden')
        this.btns['revert'].classList.remove('inline-hidden')

        this.editablesForeach((el: HTMLElement) => {
            el.classList.add('inline-editing')
            if (el.innerText.trim() === '') {
                // fix empty inline
                el.classList.add('inline-empty')
            }
            this.tryModifyLinkBehavior(el, false)
        })

        for (let optionsName in this.editableConfigs) {

            let settings = (<any>Object).assign({
                entities: '160,nbsp',
                inline: true,
                menubar: false,
                language: 'cs',
                plugins: 'paste link image lists nonbreaking',
                paste_as_text: true,
                theme: 'modern',
                setup: (editor: Editor) => editor.on('keyup change redo undo', () => this.updateTinymceContent(editor))
            }, this.editableConfigs[optionsName])

            tinymce.init(settings)
        }

        this.applySpecificEditable()
    }

    // disable all
    public disable() {
        this.btns['disable'].classList.add('inline-hidden')
        this.btns['status'].classList.add('inline-hidden')
        this.btns['save'].classList.add('inline-hidden')
        this.btns['revert'].classList.add('inline-hidden')
        this.btns['enable'].classList.remove('inline-hidden')

        this.editablesForeach((el) => {
            el.classList.remove('inline-editing')
            this.tryModifyLinkBehavior(el, true)
        })

        tinymce.remove()
        this.removeSpecificEditable()
    }

    // backup all content to data properties
    public backup() {
        this.editablesForeach((el) => this.backups[el.id] = el.innerHTML)
    }

    // helper for iterate over editables
    private editablesForeach(callback: (el: Element) => void) {
        for (let i = 0; i < this.editables.length; i++) {
            callback(this.editables[i])
        }
    }

    // helper for enable/disable links
    private tryModifyLinkBehavior(el: Element, response: boolean) {
        let link = el.closest('a')
        if (link) {
            link.onclick = () => response
        }
    }

    // register specific entity listeners and generate unique ids
    private applySpecificEditable() {
        this.editablesForeach((el: HTMLBodyElement) => {
            if (el.classList.contains('inline-editing-specific')) {
                el.addEventListener('keypress', (evt: KeyboardEvent) => {
                    if (evt.which === 13) {
                        evt.preventDefault()
                    }
                })

                el.addEventListener('keyup', this.updateSpecificContent)
                el.addEventListener('change', this.updateSpecificContent)
                el.addEventListener('redo', this.updateSpecificContent)
                el.addEventListener('undo', this.updateSpecificContent)

                el.setAttribute('contenteditable', 'true')
            }
        })
    }

    // unregister specific entity listeners
    private removeSpecificEditable() {
        this.editablesForeach((el) => {
            if (el.classList.contains('inline-editing-specific')) {
                el.removeEventListener('keyup', this.updateSpecificContent)
                el.removeEventListener('change', this.updateSpecificContent)
                el.removeEventListener('redo', this.updateSpecificContent)
                el.removeEventListener('undo', this.updateSpecificContent)
                el.removeAttribute('contenteditable')
            }
        })
    }

    // update changes list - specific items
    public updateSpecificContent = (evt: Event) => {

        let el = <HTMLBodyElement>evt.target
        let key = el.id

        if (this.changes.hasOwnProperty(key)) {
            this.changes[key].content = el.textContent
        } else {
            this.changes[key] = new EntityItem(
                el.dataset['inlineEntity'],
                el.dataset['inlineId'],
                el.dataset['inlineProperty'],
                el.textContent
            )
        }

        this.btns['status'].classList.add('inline-hidden')
        this.btns['save'].classList.remove('inactive')
        this.btns['revert'].classList.remove('inactive')
    }
}

document.addEventListener('DOMContentLoaded', () => (<any>window).xcoreInline = new Inline)
