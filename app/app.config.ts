export default defineAppConfig({
  ui: {
    colors: {
      primary: 'purple',
      neutral: 'slate'
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
    },
    dashboardPanel: {
      slots: {
        body: 'pb-[60px] lg:pb-6'
      }
    }
  }
})
