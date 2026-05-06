import sharp from 'sharp';

/**
 * 提取图片颜色并返回 CSS 弥散渐变 (多层径向渐变叠加)
 */
export async function getLqipGradient(fsPath: string): Promise<string> {
  try {
    // 采样 3 个像素点
    const { data } = await sharp(fsPath)
      .resize(3, 1, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const c = [];
    for (let i = 0; i < data.length; i += 3) {
      c.push(`rgb(${data[i]}, ${data[i + 1]}, ${data[i + 2]})`);
    }

    /**
     * 构建弥散效果：
     * 利用三个不同位置的 radial-gradient 叠加
     * 1. 左上角扩散第一个色值
     * 2. 右下角扩散第二个色值
     * 3. 中心偏下扩散第三个色值
     */
    const meshGradient = `
      radial-gradient(at 0% 0%, ${c[0]} 0%, transparent 50%), 
      radial-gradient(at 100% 100%, ${c[1]} 0%, transparent 50%), 
      radial-gradient(at 50% 100%, ${c[2]} 0%, transparent 50%),
      ${c[0]}
    `.replace(/\s+/g, ' '); // 压缩成一行

    return meshGradient;
  } catch (error) {
    console.error(`[LQIP Error]: ${fsPath}`, error);
    // 兜底渐变
    return 'linear-gradient(110deg, #e2e8f0, #f8fafc, #e2e8f0)';
  }
}