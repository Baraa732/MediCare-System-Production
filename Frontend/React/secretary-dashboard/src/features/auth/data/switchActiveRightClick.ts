export const switchActiveRightClick = (passwordShow: boolean) => {
  console.log(passwordShow)
  return {
    onCopy: () => passwordShow,
    onPaste: () => passwordShow,
    onCut: () => passwordShow,
    onContextMenu: () => passwordShow,
    
  };
};
