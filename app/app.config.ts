export default defineAppConfig({
  ui: {
    colors: {
      primary: 'green',
      neutral: 'zinc'
    },
    popover: {
      slots: {
        content: 'z-[320]'
      }
    },
    select: {
      slots: {
        content: 'z-[320]'
      }
    },
    selectMenu: {
      slots: {
        content: 'z-[320]'
      }
    },
    inputMenu: {
      slots: {
        content: 'z-[320]'
      }
    },
    modal: {
      slots: {
        content: 'max-h-[90vh] flex flex-col',
        body: 'overflow-y-auto'
      }
    }
  }
})
